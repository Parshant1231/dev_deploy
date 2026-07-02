import { apiClient } from './client';
import { Project, ApiResponse } from '@/types';

export interface CreateProjectInput {
  name: string;
  description?: string;
  framework: 'nodejs' | 'react' | 'nextjs' | 'static';
  branch: string;
  port: number;
  buildCommand?: string;
  startCommand?: string;
}

export interface LinkRepoInput {
  repoFullName: string;
  repoUrl: string;
  branch: string;
}

export const projectsApi = {
  async list(): Promise<Project[]> {
    const { data } = await apiClient.get<ApiResponse<Project[]>>('/projects');
    return data.data ?? [];
  },

  async get(projectId: string): Promise<Project> {
    const { data } = await apiClient.get<ApiResponse<Project>>(
      `/projects/${projectId}`
    );
    return data.data!;
  },

  async create(input: CreateProjectInput): Promise<Project> {
    const { data } = await apiClient.post<ApiResponse<Project>>(
      '/projects',
      input
    );
    return data.data!;
  },

  async update(projectId: string, input: Partial<CreateProjectInput>): Promise<Project> {
    const { data } = await apiClient.put<ApiResponse<Project>>(
      `/projects/${projectId}`,
      input
    );
    return data.data!;
  },

  async linkRepo(projectId: string, input: LinkRepoInput): Promise<Project> {
    const { data } = await apiClient.post<ApiResponse<Project>>(
      `/projects/${projectId}/repo`,
      input
    );
    return data.data!;
  },

  async delete(projectId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}`);
  },
};