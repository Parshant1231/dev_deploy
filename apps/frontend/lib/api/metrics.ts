import { apiClient } from './client';
import { ApiResponse } from '@/types';

export interface ProjectMetricsSummary {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  successRate: number;
  averageBuildTimeSeconds: number | null;
}

export const metricsApi = {
  async getProjectSummary(projectId: string): Promise<ProjectMetricsSummary> {
    const { data } = await apiClient.get<ApiResponse<ProjectMetricsSummary>>(
      `/projects/${projectId}/metrics/summary`
    );
    return data.data!;
  },
};