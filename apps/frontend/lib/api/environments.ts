import { apiClient } from './client';
import { Environment, ApiResponse } from '@/types';

export const environmentsApi = {
  async list(projectId: string): Promise<Environment[]> {
    const { data } = await apiClient.get<ApiResponse<Environment[]>>(
      `/projects/${projectId}/environments`
    );
    return data.data ?? [];
  },

  async create(
    projectId: string,
    name: 'dev' | 'staging' | 'production',
    ttlHours: number
  ): Promise<Environment> {
    const { data } = await apiClient.post<ApiResponse<Environment>>(
      `/projects/${projectId}/environments`,
      { name, ttlHours }
    );
    return data.data!;
  },

  async updateTTL(
    projectId: string,
    environmentId: string,
    ttlHours: number
  ): Promise<void> {
    await apiClient.patch(
      `/projects/${projectId}/environments/${environmentId}/ttl`,
      { ttlHours }
    );
  },

  async destroy(projectId: string, environmentId: string): Promise<void> {
    await apiClient.post(
      `/projects/${projectId}/environments/${environmentId}/destroy`
    );
  },
};