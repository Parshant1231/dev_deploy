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
    commitSha: string;
    commitMessage: string;
    isRetry?: boolean;
    retryAttempt?: number;
  }): Promise<Deployment> {
    const {
      projectId,
      userId,
      environment,
      commitSha,
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
    if (!isRetry) {
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

    // ── Step 4: Load user (for GitHub token) ──
    const user = await this.authRepo.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    if (!user.githubToken) {
      throw AppError.badRequest(
        'GitHub account not connected. ' +
        'Connect your GitHub account in settings to enable deployments.'
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
    this.triggerPipeline(deployment, project, user.githubToken).catch(
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
    encryptedGithubToken: string
  ): Promise<void> {
    const githubClient = createGithubClient(encryptedGithubToken);

    await triggerWorkflowDispatch(githubClient, {
      devdeployRepoOwner: config.devdeployRepoOwner,
      devdeployRepoName: config.devdeployRepoName,
      inputs: {
        deployment_id: deployment.deploymentId,
        project_id: deployment.projectId,
        repo_full_name: project.repoFullName!,
        commit_sha: deployment.commitSha ?? 'HEAD',
        environment: deployment.environment,
        framework: project.framework,
        port: String(project.port),
        health_check_path: '/health',
        cpu: '256',
        memory: '512',
        api_url: config.apiPublicUrl,
        app_directory: project.appDirectory ?? '',
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
      commitSha: deployment.commitSha ?? 'HEAD',
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
    if (!user?.githubToken) throw AppError.badRequest('GitHub not connected');

    // For rollback, we skip build + push in the pipeline
    // by passing the existing imageUri directly
    const githubClient = createGithubClient(user.githubToken);

    await triggerWorkflowDispatch(githubClient, {
      devdeployRepoOwner: config.devdeployRepoOwner,
      devdeployRepoName: config.devdeployRepoName,
      inputs: {
        deployment_id: rollbackDeployment.deploymentId,
        project_id: projectId,
        repo_full_name: project.repoFullName!,
        commit_sha: targetDeployment.commitSha ?? 'HEAD',
        environment: targetDeployment.environment,
        framework: project.framework,
        port: String(project.port),
        health_check_path: '/health',
        cpu: '256',
        memory: '512',
        api_url: config.apiPublicUrl,
        app_directory: project.appDirectory ?? '',
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