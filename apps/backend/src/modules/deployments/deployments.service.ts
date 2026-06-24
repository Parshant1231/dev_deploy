import { DeploymentsRepository } from './deployments.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { AppError } from '../../shared/errors/AppError';
import { generateId } from '../../shared/utils/id';
import { Deployment, DeploymentStatus } from '../../shared/types';

export class DeploymentsService {
  private readonly repo = new DeploymentsRepository();
  private readonly projectsRepo = new ProjectsRepository();

  async createDeployment(
    userId: string,
    projectId: string,
    options: {
      environment: 'dev' | 'staging' | 'production';
      commitSha?: string;
      commitMessage?: string;
    }
  ): Promise<Deployment> {
    // Verify project exists and belongs to user
    const project = await this.projectsRepo.findById(projectId);
    if (!project) throw AppError.notFound('Project not found');
    if (project.userId !== userId) throw AppError.forbidden('Access denied');

    // Prevent duplicate active deployments for same environment
    const active = await this.repo.findActiveByProjectAndEnvironment(
      projectId,
      options.environment
    );

    if (active) {
      throw AppError.conflict(
        `A deployment is already in progress for the ${options.environment} environment. ` +
        `Deployment ID: ${active.deploymentId} (Status: ${active.status})`
      );
    }

    const deployment: Deployment = {
      deploymentId: generateId.deployment(),
      projectId,
      userId,
      environment: options.environment,
      status: 'PENDING',
      branch: project.branch,
      commitSha: options.commitSha,
      commitMessage: options.commitMessage,
      createdAt: new Date().toISOString(),
    };

    return this.repo.create(deployment);
  }

  async getDeployments(
    projectId: string,
    userId: string
  ): Promise<Deployment[]> {
    // Verify ownership
    const project = await this.projectsRepo.findById(projectId);
    if (!project) throw AppError.notFound('Project not found');
    if (project.userId !== userId) throw AppError.forbidden('Access denied');

    return this.repo.findByProjectId(projectId);
  }

  async getDeployment(
    deploymentId: string,
    projectId: string,
    userId: string
  ): Promise<Deployment> {
    const deployment = await this.repo.findById(deploymentId, projectId);
    if (!deployment) throw AppError.notFound('Deployment not found');

    const project = await this.projectsRepo.findById(projectId);
    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied');
    }

    return deployment;
  }

  async updateDeploymentStatus(
    deploymentId: string,
    projectId: string,
    status: DeploymentStatus,
    additionalData?: Partial<Deployment>
  ): Promise<void> {
    const deployment = await this.repo.findById(deploymentId, projectId);
    if (!deployment) throw AppError.notFound('Deployment not found');

    this.validateTransition(deployment.status, status);

    await this.repo.updateStatus(deploymentId, projectId, status, additionalData);
  }

  async cancelDeployment(
    deploymentId: string,
    projectId: string,
    userId: string
  ): Promise<void> {
    const deployment = await this.getDeployment(deploymentId, projectId, userId);

    const cancellableStatuses: DeploymentStatus[] = ['PENDING', 'BUILDING'];
    if (!cancellableStatuses.includes(deployment.status)) {
      throw AppError.badRequest(
        `Cannot cancel deployment in ${deployment.status} status. ` +
        `Only PENDING or BUILDING deployments can be cancelled.`
      );
    }

    await this.repo.updateStatus(deploymentId, projectId, 'CANCELLED');
  }

  // ─────────────────────────────────────────────
  // State machine enforcement
  // ─────────────────────────────────────────────

  private validateTransition(
    current: DeploymentStatus,
    next: DeploymentStatus
  ): void {
    const validTransitions: Record<DeploymentStatus, DeploymentStatus[]> = {
      PENDING: ['BUILDING', 'CANCELLED'],
      BUILDING: ['PUSHING_IMAGE', 'FAILED', 'CANCELLED'],
      PUSHING_IMAGE: ['DEPLOYING', 'FAILED'],
      DEPLOYING: ['RUNNING', 'FAILED'],
      RUNNING: ['DESTROYED'],
      FAILED: ['PENDING'],
      CANCELLED: [],
      DESTROYED: [],
    };

    if (!validTransitions[current].includes(next)) {
      throw AppError.badRequest(
        `Invalid state transition: ${current} → ${next}. ` +
        `Valid transitions from ${current}: ${validTransitions[current].join(', ') || 'none'}`
      );
    }
  }
}