import { ProjectsRepository } from './projects.repository';
import { AppError } from '../../shared/errors/AppError';
import { generateId } from '../../shared/utils/id';
import { Project } from '../../shared/types';
import {
  CreateProjectInput,
  UpdateProjectInput,
  LinkRepoInput,
} from './projects.schemas';

export class ProjectsService {
  private readonly repo = new ProjectsRepository();

  async createProject(
    userId: string,
    input: CreateProjectInput
  ): Promise<Project> {
    const now = new Date().toISOString();

    const project: Project = {
      projectId: generateId.project(),
      userId,
      name: input.name,
      description: input.description,
      branch: input.branch,
      framework: input.framework,
      buildCommand: input.buildCommand,
      startCommand: input.startCommand,
      port: input.port,
      envVars: input.envVars,
      createdAt: now,
      updatedAt: now,
      status: 'ACTIVE',
    };

    return this.repo.create(project);
  }

  async getProjects(userId: string): Promise<Project[]> {
    return this.repo.findByUserId(userId);
  }

  async getProject(projectId: string, userId: string): Promise<Project> {
    const project = await this.repo.findById(projectId);
    if (!project) throw AppError.notFound('Project not found');

    // Authorization: users can only access their own projects
    if (project.userId !== userId) throw AppError.forbidden('Access denied');

    return project;
  }

  async updateProject(
    projectId: string,
    userId: string,
    input: UpdateProjectInput
  ): Promise<Project> {
    const project = await this.getProject(projectId, userId);
    await this.repo.update(projectId, input);
    return { ...project, ...input, updatedAt: new Date().toISOString() };
  }

  async linkRepository(
    projectId: string,
    userId: string,
    input: LinkRepoInput
  ): Promise<Project> {
    const project = await this.getProject(projectId, userId);
    await this.repo.update(projectId, {
      repoFullName: input.repoFullName,
      repoUrl: input.repoUrl,
      branch: input.branch,
      appDirectory: input.appDirectory,
    });
    return {
      ...project,
      repoFullName: input.repoFullName,
      repoUrl: input.repoUrl,
      branch: input.branch,
      appDirectory: input.appDirectory,
    };
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    await this.getProject(projectId, userId);
    await this.repo.delete(projectId);
  }
}