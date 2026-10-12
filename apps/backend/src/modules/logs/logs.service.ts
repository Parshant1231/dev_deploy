import { queryLogs } from '../../aws/cloudwatchLogs';
import { DeploymentsRepository } from '../deployments/deployments.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { AppError } from '../../shared/errors/AppError';

const LOG_GROUP = '/devdeploy/dev/user-apps';

export class LogsService {
  private readonly deploymentsRepo = new DeploymentsRepository();
  private readonly projectsRepo = new ProjectsRepository();

  // ─────────────────────────────────────────────
  // GET DEPLOYMENT LOGS
  //
  // Queries CloudWatch Logs Insights for the
  // container log stream belonging to this deployment.
  //
  // Streams are prefixed with the projectId (set in
  // the ECS task definition logConfiguration).
  // We filter to that prefix so we only return
  // logs from this specific deployment's container.
  // ─────────────────────────────────────────────

  async getDeploymentLogs(
    deploymentId: string,
    projectId: string,
    userId: string,
    options: { since?: number } = {}
  ): Promise<{ timestamp: string; message: string }[]> {
    // Verify ownership
    const project = await this.projectsRepo.findById(projectId);
    if (!project) throw AppError.notFound('Project not found');
    if (project.userId !== userId) throw AppError.forbidden('Access denied');

    const deployment = await this.deploymentsRepo.findById(deploymentId, projectId);
    if (!deployment) throw AppError.notFound('Deployment not found');

    // Only running/completed deployments have logs
    const loggableStatuses = ['BUILDING', 'PUSHING_IMAGE', 'DEPLOYING', 'RUNNING', 'FAILED'];
    if (!loggableStatuses.includes(deployment.status)) {
      return [];
    }

    // Time window: deployment creation → now (or since param)
    const startTime = options.since
      ? options.since
      : Math.floor(new Date(deployment.createdAt).getTime() / 1000);

    const endTime = Math.floor(Date.now() / 1000);

    try {
      return await queryLogs({
        logGroupName: LOG_GROUP,
        streamPrefix: projectId,   // ECS log streams are prefixed with projectId
        startTime,
        endTime,
        limit: 200,
      });
    } catch (error) {
      // If the log group doesn't exist yet (no deployments have run),
      // return empty rather than a 500
      console.warn(`Could not fetch logs for ${deploymentId}:`, error);
      return [];
    }
  }
}
