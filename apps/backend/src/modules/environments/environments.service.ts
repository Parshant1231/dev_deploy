import { EnvironmentsRepository } from './environments.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { AppError } from '../../shared/errors/AppError';
import { generateId } from '../../shared/utils/id';
import { Environment } from '../../shared/types';
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda';
import { config } from '../../config/env';

// Add Lambda client
const lambdaClient = new LambdaClient({ region: config.awsRegion });

export class EnvironmentsService {
  private readonly repo = new EnvironmentsRepository();
  private readonly projectsRepo = new ProjectsRepository();

  async createEnvironment(
    userId: string,
    projectId: string,
    name: 'dev' | 'staging' | 'production',
    ttlHours = 24
  ): Promise<Environment> {
    const project = await this.projectsRepo.findById(projectId);
    if (!project) throw AppError.notFound('Project not found');
    if (project.userId !== userId) throw AppError.forbidden('Access denied');

    const now = new Date().toISOString();
    const ttl = Math.floor(Date.now() / 1000) + ttlHours * 3600;

    const environment: Environment = {
      environmentId: generateId.environment(),
      projectId,
      userId,
      name,
      status: 'IDLE',
      lastActivityAt: now,
      ttlHours,
      ttl,
      createdAt: now,
      updatedAt: now,
    };

    return this.repo.create(environment);
  }

  async getEnvironments(projectId: string, userId: string): Promise<Environment[]> {
    const project = await this.projectsRepo.findById(projectId);
    if (!project) throw AppError.notFound('Project not found');
    if (project.userId !== userId) throw AppError.forbidden('Access denied');

    return this.repo.findByProjectId(projectId);
  }

  async updateTTL(
    environmentId: string,
    projectId: string,
    userId: string,
    ttlHours: number
  ): Promise<void> {
    const project = await this.projectsRepo.findById(projectId);
    if (!project || project.userId !== userId) throw AppError.forbidden('Access denied');

    await this.repo.updateTTL(environmentId, projectId, ttlHours);
  }

  async destroyEnvironment(
    environmentId: string,
    projectId: string,
    userId: string
  ): Promise<void> {
    const project = await this.projectsRepo.findById(projectId);
    if (!project || project.userId !== userId) {
      throw AppError.forbidden('Access denied');
    }

    const environment = await this.repo.findById(environmentId, projectId);
    if (!environment) throw AppError.notFound('Environment not found');
    if (environment.status === 'DESTROYED') {
      throw AppError.badRequest('Environment is already destroyed');
    }
    if (environment.status === 'DESTROYING') {
      throw AppError.badRequest('Environment is already being destroyed');
    }

    // Mark as DESTROYING immediately
    await this.repo.updateStatus(environmentId, projectId, 'DESTROYING');

    // Invoke Lambda asynchronously for immediate cleanup
    // Event invocation = fire and forget (Lambda runs after API responds)
    if (config.autoDestroyFunctionName) {
      try {
        await lambdaClient.send(
          new InvokeCommand({
            FunctionName:   config.autoDestroyFunctionName,
            InvocationType: InvocationType.Event, // Async — does not wait for response
            Payload: Buffer.from(
              JSON.stringify({
                source:          'api-manual-destroy',
                environmentId,
                projectId,
                forceImmediate:  true,
              })
            ),
          })
        );
        console.log(`Lambda invoked for immediate destroy of ${environmentId}`);
      } catch (error) {
        // Lambda invoke failure does not break the API response.
        // The scheduler will pick it up within 15 minutes.
        console.error('Lambda invoke failed — scheduler will clean up:', error);
      }
    }
  }
}