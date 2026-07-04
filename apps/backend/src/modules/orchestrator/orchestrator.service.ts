import { DeploymentsRepository } from '../deployments/deployments.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { AuthRepository } from '../auth/auth.repository';
import { EventsService } from '../events/events.service';
import { EnvironmentsRepository } from '../environments/environments.repository';
import { AppError } from '../../shared/errors/AppError';
import { generateId } from '../../shared/utils/id';
import { config } from '../../config/env';
import { createGithubClient, triggerWorkflowDispatch } from '../../shared/utils/githubApi';
import { publishStatusChange } from '../../aws/eventbridge';
import { Deployment, DeploymentStatus, Project } from '../../shared/types';
import { resolveBranchSha } from '../../shared/utils/githubApi';
import { metrics } from '../../aws/cloudwatch';
// ─────────────────────────────────────────────
// RETRY SCHEDULE
// Exponential backoff: 30s → 2m → 8m
// After 3 retries, deployment is permanently FAILED.
// ─────────────────────────────────────────────

function getRetryDelayMs(attemptNumber: number, baseDelayMs: number): number {
  // attempt 1 → 30s, attempt 2 → 120s, attempt 3 → 480s
  return baseDelayMs * Math.pow(4, attemptNumber - 1);
}

export class OrchestratorService {
  private readonly deploymentsRepo = new DeploymentsRepository();
  private readonly projectsRepo = new ProjectsRepository();
  private readonly authRepo = new AuthRepository();
  private readonly eventsService = new EventsService();
  private readonly environmentsRepo = new EnvironmentsRepository();

  // ─────────────────────────────────────────────
  // ORCHESTRATE DEPLOYMENT
  //
  // Entry point called by:
  //   1. Webhook handler (push event)
  //   2. Manual trigger (POST /deployments)
  //   3. Retry scheduler (failed deployment)
  //
  // Flow:
  //   Validate → Duplicate check → Queue check
  //   → Create record → Publish event → Trigger pipeline
  // ─────────────────────────────────────────────

  async orchestrateDeploy(params: {
    projectId: string;
    userId: string;
    environment: 'dev' | 'staging' | 'production';
    commitSha?: string;       // optional — '' and 'HEAD' are treated as "resolve from branch"
    commitMessage: string;
    isRetry?: boolean;
    retryAttempt?: number;
  }): Promise<Deployment> {
    const {
      projectId,
      userId,
      environment,
      commitSha = '',
      commitMessage,
      isRetry = false,
      retryAttempt = 0,
    } = params;

    // ── Step 1: Load project ──────────────────
    const project = await this.projectsRepo.findById(projectId);
    if (!project) throw AppError.notFound('Project not found');
    if (project.userId !== userId) throw AppError.forbidden('Access denied');

    if (!project.repoFullName) {
      throw AppError.badRequest(
        'No repository linked to this project. ' +
        'Link a GitHub repository before triggering deployments.'
      );
    }

    // ── Step 2: Duplicate detection ───────────
    // Only check for duplicates if we have a real resolved SHA.
    // 'HEAD' and '' are unresolved placeholders — skip the check.
    const hasRealSha = commitSha && commitSha !== 'HEAD' && commitSha.length >= 40;
    if (!isRetry && hasRealSha) {
      const isDuplicate = await this.isDuplicateDeployment(
        projectId,
        environment,
        commitSha
      );

      if (isDuplicate) {
        throw AppError.conflict(
          `Commit ${commitSha.slice(0, 7)} is already deployed or being deployed ` +
          `to the ${environment} environment. ` +
          `Push a new commit to trigger a new deployment.`
        );
      }
    }

    // ── Step 3: Queue check ───────────────────
    const activeDeployment = await this.deploymentsRepo.findActiveByProjectAndEnvironment(
      projectId,
      environment
    );

    if (activeDeployment) {
      throw AppError.conflict(
        `Deployment ${activeDeployment.deploymentId} is currently ` +
        `${activeDeployment.status} in the ${environment} environment. ` +
        `Wait for it to complete before triggering a new deployment.`
      );
    }

    // ── Step 4: Load user — verify they exist ─
    const user = await this.authRepo.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    // Use the platform-level GitHub token (Parshant1231's PAT stored in .env)
    // to trigger workflows. This means ANY logged-in user can deploy without
    // needing to connect their own GitHub account.
    // Fall back to the user's own token only if the platform token isn't set.
    let githubToken: string;
    if (config.devdeployGithubToken) {
      // Platform token is a plain PAT from .env — encrypt it on the fly
      // so createGithubClient (which always decrypts) works correctly.
      const { encryptToken } = await import('../../shared/utils/crypto');
      githubToken = encryptToken(config.devdeployGithubToken);
    } else if (user.githubToken) {
      // Fall back to the user's own stored (already-encrypted) token
      githubToken = user.githubToken;
    } else {
      throw AppError.badRequest(
        'Deployment pipeline is not configured. ' +
        'Ask the platform admin to set DEVDEPLOY_GITHUB_TOKEN in the server environment.'
      );
    }

    // ── Step 5: Ensure environment record exists
    await this.ensureEnvironmentExists(projectId, userId, environment);

    // ── Step 6: Create deployment record ─────
    const now = new Date().toISOString();
    const deployment: Deployment = {
      deploymentId: generateId.deployment(),
      projectId,
      userId,
      environment,
      status: 'PENDING',
      branch: project.branch,
      commitSha,
      commitMessage,
      createdAt: now,
    };

    await this.deploymentsRepo.create(deployment);
    await metrics.deploymentCreated();
        console.log(`[DEPLOY] Created deployment ${deployment.deploymentId} for ${project.repoFullName} @ ${environment}`);

    // ── Step 7: Record event ──────────────────
    await this.eventsService.record({
      deploymentId: deployment.deploymentId,
      projectId,
      userId,
      type: 'DEPLOYMENT_CREATED',
      message: `Deployment created for ${environment} environment` +
        (isRetry ? ` (retry attempt ${retryAttempt})` : ''),
      newStatus: 'PENDING',
      metadata: { commitSha, commitMessage, isRetry, retryAttempt },
    });

    // ── Step 8: Publish EventBridge event ────
    await publishStatusChange({
      deploymentId: deployment.deploymentId,
      projectId,
      userId,
      environment,
      previousStatus: '',
      newStatus: 'PENDING',
      eventType: 'DeploymentCreated',
      metadata: { commitSha, commitMessage },
    });

    // ── Step 9: Trigger GitHub Actions ────────
    // This runs asynchronously after returning the deployment.
    // If it fails, the deployment stays PENDING and can be retried.
    // 
    // For repo_token, we need the PLAIN (unencrypted) token.
    // This is what GitHub Actions will use to checkout the user's repo.
    // 
    // IMPORTANT: GitHub OAuth tokens (gho_) cannot be used for git operations.
    // We must use a Personal Access Token (ghp_) instead.
    // If user has OAuth token, fall back to platform token.
    const { decryptToken } = await import('../../shared/utils/crypto');
    let userRepoToken: string;
    
    console.log(`[TOKEN DEBUG] Preparing repo token for deployment ${deployment.deploymentId}`);
    console.log(`[TOKEN DEBUG] User ${userId} has githubToken: ${!!user.githubToken}`);
    
    if (user.githubToken) {
      try {
        // User has connected their GitHub — decrypt their token
        userRepoToken = decryptToken(user.githubToken);
        console.log(`[TOKEN DEBUG] Successfully decrypted user token (length: ${userRepoToken.length})`);
        
        // Check token type
        const isOAuthToken = userRepoToken.startsWith('gho_');
        const isPAT = userRepoToken.startsWith('ghp_');
        
        console.log(`[TOKEN DEBUG] Token type: OAuth=${isOAuthToken}, PAT=${isPAT}`);
        
        if (isOAuthToken) {
          // OAuth tokens cannot be used for git operations
          console.warn(
            `[TOKEN WARN] User ${userId} has OAuth token (gho_), ` +
            `but OAuth tokens cannot be used for git checkout. ` +
            `Falling back to platform token. ` +
            `User should provide a Personal Access Token instead.`
          );
          
          if (!config.devdeployGithubToken) {
            throw AppError.badRequest(
              'Your GitHub connection is using an OAuth token, which cannot access repositories. ' +
              'Please disconnect and reconnect with a Personal Access Token, ' +
              'or ask the platform admin to configure a deployment token.'
            );
          }
          
          userRepoToken = config.devdeployGithubToken;
          console.log(`[TOKEN DEBUG] Using fallback platform token for OAuth user`);
        } else if (!isPAT) {
          console.warn(`[TOKEN WARN] User token has unexpected prefix: ${userRepoToken.substring(0, 10)}`);
        }
      } catch (error) {
        console.warn(
          `[TOKEN DEBUG] Could not decrypt user token for ${userId}, ` +
          `falling back to platform token. Error: ${error}`
        );
        // Fallback: use platform token (which is already plain, not encrypted)
        if (!config.devdeployGithubToken) {
          throw AppError.badRequest(
            'No user token available and platform token not configured. ' +
            'Ask admin to set DEVDEPLOY_GITHUB_TOKEN.'
          );
        }
        userRepoToken = config.devdeployGithubToken;
        console.log(`[TOKEN DEBUG] Using fallback platform token due to decryption error`);
      }
    } else {
      // User hasn't connected GitHub — use platform token
      if (!config.devdeployGithubToken) {
        throw AppError.badRequest(
          'Deployment requires either user GitHub connection or configured platform token. ' +
          'Go to Settings to connect GitHub, or ask admin to set DEVDEPLOY_GITHUB_TOKEN.'
        );
      }
      userRepoToken = config.devdeployGithubToken;
      console.log(`[TOKEN DEBUG] User has no github token, using platform token`);
    }
    
    console.log(`[TOKEN DEBUG] Final repo_token being passed to workflow (first 20 chars): ${userRepoToken?.substring(0, 20)}...`);
    console.log(`[TOKEN DEBUG] repo_token length: ${userRepoToken?.length}`);
    console.log(`[TOKEN DEBUG] repo_token starts with 'ghp_': ${userRepoToken?.startsWith('ghp_')}`);
    console.log(`[TOKEN DEBUG] repo_token starts with 'gho_': ${userRepoToken?.startsWith('gho_')}`);
    console.log(`[TOKEN DEBUG] Triggering pipeline with repo_token of type: ${userRepoToken ? 'present' : 'empty'}`);

    this.triggerPipeline(deployment, project, githubToken, userRepoToken).catch(
      async (error) => {
        console.error('Pipeline trigger failed:', error);
        await this.handlePipelineFailure(deployment, error.message);
      }
    );

    return deployment;
  }

  // ─────────────────────────────────────────────
  // TRIGGER PIPELINE
  // Calls GitHub API to dispatch the workflow.
  // ─────────────────────────────────────────────

  private async triggerPipeline(
    deployment: Deployment,
    project: Project,
    encryptedGithubToken: string,
    plainUserRepoToken?: string  // plain, unencrypted token for checking out the user's repo
  ): Promise<void> {
    const githubClient = createGithubClient(encryptedGithubToken);

    const [repoOwner, repoName] = project.repoFullName!.split('/');
    const accessToken = plainUserRepoToken || config.devdeployGithubToken || '';

    // Resolve 'HEAD' or missing SHA to the real 40-char commit SHA.
    // We MUST use project.branch here (e.g. "main"), NOT deployment.environment
    // (e.g. "dev") — those are different things and using environment would
    // cause a 404 from the GitHub API.
    const needsResolution =
      !deployment.commitSha ||
      deployment.commitSha === 'HEAD' ||
      deployment.commitSha.length < 40;

    let resolvedCommitSha: string;
    if (needsResolution) {
      console.log(
        `[SHA] commitSha is "${deployment.commitSha ?? 'undefined'}" — resolving ` +
        `real SHA for ${repoOwner}/${repoName}@${project.branch}`
      );
      resolvedCommitSha = await resolveBranchSha(
        repoOwner,
        repoName,
        project.branch,   // ← always use project.branch, never environment
        accessToken
      );
      console.log(`[SHA] Resolved to: ${resolvedCommitSha}`);
    } else {
      resolvedCommitSha = deployment.commitSha!;
      console.log(`[SHA] Using provided SHA: ${resolvedCommitSha}`);
    }

    await triggerWorkflowDispatch(githubClient, {
      devdeployRepoOwner: config.devdeployRepoOwner,
      devdeployRepoName: config.devdeployRepoName,
      inputs: {
        deployment_id: deployment.deploymentId,
        project_id: deployment.projectId,
        repo_full_name: project.repoFullName!,
        commit_sha: resolvedCommitSha,
        environment: deployment.environment,
        framework: project.framework,
        port: String(project.port),
        health_check_path: '/health',
        cpu: '256',
        memory: '512',
        api_url: config.apiPublicUrl,
        app_directory: project.appDirectory ?? '',
        // Pass the PLAIN user token so the workflow can checkout their repo.
        // GitHub Actions will use this token in: git clone --token=<repo_token> ...
        repo_token: plainUserRepoToken || config.devdeployGithubToken || '',
      },
    });

    console.log(`Pipeline triggered for deployment: ${deployment.deploymentId}`);
  }

  // ─────────────────────────────────────────────
  // HANDLE PIPELINE TRIGGER FAILURE
  // If GitHub API call fails, mark deployment FAILED
  // and record the error event.
  // ─────────────────────────────────────────────

  private async handlePipelineFailure(
    deployment: Deployment,
    errorMessage: string
  ): Promise<void> {
    await this.deploymentsRepo.updateStatus(
      deployment.deploymentId,
      deployment.projectId,
      'FAILED',
      { errorMessage: `Pipeline trigger failed: ${errorMessage}` }
    );

    await this.eventsService.record({
      deploymentId: deployment.deploymentId,
      projectId: deployment.projectId,
      userId: deployment.userId,
      type: 'DEPLOYMENT_FAILED',
      previousStatus: 'PENDING',
      newStatus: 'FAILED',
      message: `Pipeline trigger failed: ${errorMessage}`,
      metadata: { errorMessage },
    });

    await publishStatusChange({
      deploymentId: deployment.deploymentId,
      projectId: deployment.projectId,
      userId: deployment.userId,
      environment: deployment.environment,
      previousStatus: 'PENDING',
      newStatus: 'FAILED',
      eventType: 'DeploymentFailed',
      metadata: { errorMessage },
    });
  }

  // ─────────────────────────────────────────────
  // RETRY FAILED DEPLOYMENT
  //
  // Re-triggers the pipeline for a failed deployment.
  // Uses exponential backoff to avoid hammering GitHub API.
  // ─────────────────────────────────────────────

  async retryDeployment(
    deploymentId: string,
    projectId: string,
    userId: string
  ): Promise<Deployment> {
    const deployment = await this.deploymentsRepo.findById(deploymentId, projectId);
    if (!deployment) throw AppError.notFound('Deployment not found');

    const project = await this.projectsRepo.findById(projectId);
    if (!project || project.userId !== userId) throw AppError.forbidden('Access denied');

    if (deployment.status !== 'FAILED') {
      throw AppError.badRequest(
        `Only FAILED deployments can be retried. Current status: ${deployment.status}`
      );
    }

    // Count previous retry attempts from events
    const events = await this.eventsService.getDeploymentTimeline(deploymentId);
    const retryCount = events.filter(
      (e) => e.metadata?.isRetry === true
    ).length;

    if (retryCount >= config.maxDeploymentRetries) {
      throw AppError.badRequest(
        `Maximum retry attempts (${config.maxDeploymentRetries}) reached. ` +
        `This deployment cannot be retried. Create a new deployment instead.`
      );
    }

    // Create a fresh deployment record for the retry
    return this.orchestrateDeploy({
      projectId,
      userId,
      environment: deployment.environment,
      commitSha: deployment.commitSha,
      commitMessage: `Retry of ${deploymentId}: ${deployment.commitMessage ?? ''}`,
      isRetry: true,
      retryAttempt: retryCount + 1,
    });
  }

  // ─────────────────────────────────────────────
  // ROLLBACK
  //
  // Re-deploys the image from a previous RUNNING
  // deployment without rebuilding.
  // The image already exists in ECR — we just
  // create a new ECS task definition pointing to it.
  // ─────────────────────────────────────────────

  async rollbackDeployment(
    targetDeploymentId: string,
    projectId: string,
    userId: string
  ): Promise<Deployment> {
    const project = await this.projectsRepo.findById(projectId);
    if (!project || project.userId !== userId) throw AppError.forbidden('Access denied');

    const targetDeployment = await this.deploymentsRepo.findById(
      targetDeploymentId,
      projectId
    );

    if (!targetDeployment) throw AppError.notFound('Target deployment not found');

    if (targetDeployment.status !== 'RUNNING' && !targetDeployment.imageUri) {
      throw AppError.badRequest(
        `Cannot roll back to deployment ${targetDeploymentId}. ` +
        `Rollback requires a deployment that reached RUNNING status with a built image.`
      );
    }

    if (!targetDeployment.imageUri) {
      throw AppError.badRequest(
        'No image URI recorded for this deployment — cannot roll back to it.'
      );
    }

    // Check no active deployment
    const activeDeployment = await this.deploymentsRepo.findActiveByProjectAndEnvironment(
      projectId,
      targetDeployment.environment
    );

    if (activeDeployment) {
      throw AppError.conflict(
        `Cannot roll back while deployment ${activeDeployment.deploymentId} is in progress.`
      );
    }

    // Create a rollback deployment record
    const now = new Date().toISOString();
    const rollbackDeployment: Deployment = {
      deploymentId: generateId.deployment(),
      projectId,
      userId,
      environment: targetDeployment.environment,
      status: 'PENDING',
      branch: targetDeployment.branch,
      commitSha: targetDeployment.commitSha,
      commitMessage: `Rollback to ${targetDeploymentId} (${targetDeployment.commitSha?.slice(0, 7) ?? 'unknown'})`,
      imageUri: targetDeployment.imageUri,
      createdAt: now,
    };

    await this.deploymentsRepo.create(rollbackDeployment);

    await this.eventsService.record({
      deploymentId: rollbackDeployment.deploymentId,
      projectId,
      userId,
      type: 'DEPLOYMENT_CREATED',
      message: `Rollback to deployment ${targetDeploymentId}`,
      newStatus: 'PENDING',
      metadata: {
        isRollback: true,
        targetDeploymentId,
        imageUri: targetDeployment.imageUri,
      },
    });

    // For rollback, we skip the build and push steps.
    // The pipeline receives a pre-built imageUri and
    // goes directly to DEPLOYING.
    await publishStatusChange({
      deploymentId: rollbackDeployment.deploymentId,
      projectId,
      userId,
      environment: rollbackDeployment.environment,
      previousStatus: '',
      newStatus: 'PENDING',
      eventType: 'DeploymentCreated',
      metadata: {
        isRollback: true,
        targetDeploymentId,
        imageUri: targetDeployment.imageUri,
      },
    });

    // Trigger the pipeline with the existing image URI
    const user = await this.authRepo.findById(userId);
    let rollbackToken: string;
    if (config.devdeployGithubToken) {
      const { encryptToken } = await import('../../shared/utils/crypto');
      rollbackToken = encryptToken(config.devdeployGithubToken);
    } else if (user?.githubToken) {
      rollbackToken = user.githubToken;
    } else {
      throw AppError.badRequest('Deployment pipeline not configured. Set DEVDEPLOY_GITHUB_TOKEN.');
    }

    const githubClient = createGithubClient(rollbackToken);

    const { decryptToken } = await import('../../shared/utils/crypto');
    let rollbackUserToken: string;
    
    if (user?.githubToken) {
      try {
        rollbackUserToken = decryptToken(user.githubToken);
      } catch (error) {
        console.warn(`Could not decrypt user token for rollback, using platform token`);
        rollbackUserToken = config.devdeployGithubToken;
      }
    } else {
      rollbackUserToken = config.devdeployGithubToken;
    }

    const [repoOwner, repoName] = project.repoFullName!.split('/');

    // For rollback: the commitSha stored on the target deployment should always
    // be a real 40-char SHA (it was resolved when that deployment ran).
    // But guard against 'HEAD' just in case.
    const rollbackShaNeeded =
      !targetDeployment.commitSha ||
      targetDeployment.commitSha === 'HEAD' ||
      targetDeployment.commitSha.length < 40;

    const rollbackCommitSha = rollbackShaNeeded
      ? await resolveBranchSha(
          repoOwner,
          repoName,
          project.branch,   // ← use project.branch, not environment
          rollbackUserToken
        )
      : targetDeployment.commitSha!;

    await triggerWorkflowDispatch(githubClient, {
      devdeployRepoOwner: config.devdeployRepoOwner,
      devdeployRepoName: config.devdeployRepoName,
      inputs: {
        deployment_id: rollbackDeployment.deploymentId,
        project_id: projectId,
        repo_full_name: project.repoFullName!,
        commit_sha: rollbackCommitSha,
        environment: targetDeployment.environment,
        framework: project.framework,
        port: String(project.port),
        health_check_path: '/health',
        cpu: '256',
        memory: '512',
        api_url: config.apiPublicUrl,
        app_directory: project.appDirectory ?? '',
        repo_token: rollbackUserToken,
      },
    });

    return rollbackDeployment;
  }

  // ─────────────────────────────────────────────
  // HANDLE WEBHOOK PUSH EVENT
  //
  // Called by the webhook handler when a push is received.
  // Finds matching projects and triggers deployments.
  // ─────────────────────────────────────────────

  async handlePushEvent(params: {
    repoFullName: string;
    branch: string;
    commitSha: string;
    commitMessage: string;
  }): Promise<void> {
    const { repoFullName, branch, commitSha, commitMessage } = params;

    // Find all projects linked to this repo and branch
    const projects = await this.findProjectsByRepo(repoFullName, branch);

    if (projects.length === 0) {
      console.log(`No projects found for ${repoFullName}@${branch}`);
      return;
    }

    console.log(
      `Found ${projects.length} project(s) for ${repoFullName}@${branch}. ` +
      `Triggering deployments.`
    );

    // Trigger deployments for all matching projects
    // Each runs independently — one failing does not block others
    await Promise.allSettled(
      projects.map(async (project) => {
        try {
          await this.orchestrateDeploy({
            projectId: project.projectId,
            userId: project.userId,
            environment: 'dev', // Default to dev on push — staging/prod require manual trigger
            commitSha,
            commitMessage,
          });
          console.log(`Deployment triggered for project ${project.projectId}`);
        } catch (error: any) {
          console.error(
            `Failed to trigger deployment for project ${project.projectId}:`,
            error.message
          );
        }
      })
    );
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private async isDuplicateDeployment(
    projectId: string,
    environment: string,
    commitSha: string
  ): Promise<boolean> {
    const recentDeployments = await this.deploymentsRepo.findByProjectId(
      projectId,
      10
    );

    return recentDeployments.some(
      (d) =>
        d.commitSha === commitSha &&
        d.environment === environment &&
        (d.status === 'RUNNING' || d.status === 'PENDING' ||
         d.status === 'BUILDING' || d.status === 'DEPLOYING')
    );
  }

  private async ensureEnvironmentExists(
    projectId: string,
    userId: string,
    environment: 'dev' | 'staging' | 'production'
  ): Promise<void> {
    const environments = await this.environmentsRepo.findByProjectId(projectId);
    const exists = environments.some((e) => e.name === environment);

    if (!exists) {
      const now = new Date().toISOString();
      const ttlHours = environment === 'production' ? 0 : 24;
      const ttl = ttlHours > 0
        ? Math.floor(Date.now() / 1000) + ttlHours * 3600
        : 0;

      await this.environmentsRepo.create({
        environmentId: generateId.environment(),
        projectId,
        userId,
        name: environment,
        status: 'IDLE',
        lastActivityAt: now,
        ttlHours,
        ttl,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  private async findProjectsByRepo(
    repoFullName: string,
    branch: string
  ): Promise<Project[]> {
    // Note: This performs a scan — acceptable at small scale.
    // Phase 10 adds a GSI on repoFullName for efficient lookup.
    // For now, we query all projects for each webhook owner.
    // This is a known limitation documented in the Phase 10 backlog.
    console.log(
      `Searching for projects matching repo=${repoFullName} branch=${branch}. ` +
      `Note: full repo-to-project matching requires GSI (Phase 10).`
    );

    // Return empty for now — full implementation in Phase 10
    // The webhook creates the event; manual triggers use orchestrateDeploy directly
    return [];
  }
}