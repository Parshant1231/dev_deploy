import { apiClient } from './client';
import { Deployment, DeploymentEvent, ApiResponse } from '@/types';

export const deploymentsApi = {
  async list(projectId: string): Promise<Deployment[]> {
    const { data } = await apiClient.get<ApiResponse<Deployment[]>>(
      `/projects/${projectId}/deployments`
    );
    return data.data ?? [];
  },

  async get(projectId: string, deploymentId: string): Promise<Deployment> {
    const { data } = await apiClient.get<ApiResponse<Deployment>>(
      `/projects/${projectId}/deployments/${deploymentId}`
    );
    return data.data!;
  },

  async trigger(
    projectId: string,
    params: { environment: string; commitSha: string; commitMessage: string }
  ): Promise<Deployment> {
    const { data } = await apiClient.post<ApiResponse<Deployment>>(
      `/projects/${projectId}/deploy`,
      params
    );
    return data.data!;
  },

  async cancel(projectId: string, deploymentId: string): Promise<void> {
    await apiClient.post(
      `/projects/${projectId}/deployments/${deploymentId}/cancel`
    );
  },

  async retry(projectId: string, deploymentId: string): Promise<Deployment> {
    const { data } = await apiClient.post<ApiResponse<Deployment>>(
      `/projects/${projectId}/deployments/${deploymentId}/retry`
    );
    return data.data!;
  },

  async rollback(projectId: string, deploymentId: string): Promise<Deployment> {
    const { data } = await apiClient.post<ApiResponse<Deployment>>(
      `/projects/${projectId}/deployments/${deploymentId}/rollback`
    );
    return data.data!;
  },

  async getUrl(
    projectId: string,
    deploymentId: string
  ): Promise<{ url: string | null; status: string }> {
    const { data } = await apiClient.get<ApiResponse<{ url: string | null; status: string }>>(
      `/projects/${projectId}/deployments/${deploymentId}/url`
    );
    return data.data!;
  },

  async getTimeline(
    projectId: string,
    deploymentId: string
  ): Promise<DeploymentEvent[]> {
    const { data } = await apiClient.get<ApiResponse<DeploymentEvent[]>>(
      `/projects/${projectId}/deployments/${deploymentId}/events`
    );
    return data.data ?? [];
  },
};