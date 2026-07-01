import { Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../../config/env';
import { DeploymentsService } from '../deployments/deployments.service';
import { ProjectsRepository } from '../projects/projects.repository';
import { AppError } from '../../shared/errors/AppError';
import { OrchestratorService } from '../orchestrator/orchestrator.service';

const orchestratorService = new OrchestratorService();
const deploymentsService = new DeploymentsService();
const projectsRepo = new ProjectsRepository();

// ─────────────────────────────────────────────
// VERIFY GITHUB SIGNATURE
// GitHub signs the payload with your webhook secret.
// We verify the signature to confirm the request
// is genuinely from GitHub and not spoofed.
// ─────────────────────────────────────────────

function verifyGithubSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) return false;

  const expectedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

  // timingSafeEqual prevents timing attacks.
  // A regular === comparison leaks information about
  // how many characters matched before the mismatch.
  // timingSafeEqual always takes the same amount of time.
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// PUSH EVENT PAYLOAD TYPES
// ─────────────────────────────────────────────

interface GithubPushPayload {
  ref: string;              // e.g. "refs/heads/main"
  after: string;            // commit SHA
  repository: {
    full_name: string;      // e.g. "username/my-app"
    clone_url: string;
  };
  head_commit: {
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  } | null;
  sender: {
    login: string;
  };
}

// ─────────────────────────────────────────────
// WEBHOOK HANDLER
// ─────────────────────────────────────────────

export async function handleGithubWebhook(
  req: Request,
  res: Response
): Promise<void> {
  // Step 1 — Verify the signature
  const signature = req.headers['x-hub-signature-256'] as string;
  const rawBody = JSON.stringify(req.body);

  if (!config.githubWebhookSecret) {
    console.warn('GITHUB_WEBHOOK_SECRET is not set — skipping signature verification');
  } else {
    const isValid = verifyGithubSignature(rawBody, signature, config.githubWebhookSecret);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }
  }

  // Step 2 — Identify the event type
  const eventType = req.headers['x-github-event'] as string;

  // Respond to GitHub immediately.
  // GitHub expects a 2xx response within 10 seconds.
  // All heavy processing happens after we respond.
  res.status(200).json({ received: true });

  // Step 3 — Route to the right handler
  if (eventType === 'push') {
    await handlePushEvent(req.body as GithubPushPayload);
  } else if (eventType === 'ping') {
    console.log('GitHub webhook ping received — webhook is configured correctly');
  }
  // Other events (pull_request, release) can be added in Phase 6
}

// ─────────────────────────────────────────────
// PUSH EVENT HANDLER
// ─────────────────────────────────────────────

async function handlePushEvent(payload: GithubPushPayload): Promise<void> {
  try {
    const repoFullName = payload.repository.full_name;
    const branch = payload.ref.replace('refs/heads/', '');
    const commitSha = payload.after;
    const commitMessage = payload.head_commit?.message ?? 'No commit message';

    // Filter out branch deletions
    // When a branch is deleted, 'after' is all zeros
    if (commitSha === '0000000000000000000000000000000000000000') {
      console.log(`Branch deletion event for ${repoFullName}@${branch} — skipping`);
      return;
    }

    console.log(
      `Push event: ${repoFullName}@${branch} ` +
      `commit=${commitSha.slice(0, 7)} ` +
      `message="${commitMessage.split('\n')[0]}"`
    );

    await orchestratorService.handlePushEvent({
      repoFullName,
      branch,
      commitSha,
      commitMessage: commitMessage.split('\n')[0], // First line only
    });
  } catch (error) {
    console.error('Error handling push event:', error);
  }
}

// Finds projects by repository and branch
// This will be optimized with a GSI in Phase 10
async function findProjectsByRepo(
  repoFullName: string,
  branch: string
): Promise<Array<{ projectId: string; userId: string }>> {
  // For now, return empty — the webhook creates the record
  // and GitHub Actions handles the actual build.
  // Full project matching is completed in Phase 6 (Orchestrator).
  console.log(`Looking for projects matching ${repoFullName}@${branch}`);
  return [];
}