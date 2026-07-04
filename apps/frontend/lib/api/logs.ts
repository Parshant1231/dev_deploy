import { apiClient } from './client';
import { ApiResponse } from '@/types';

export interface LogEntry {
  timestamp: string;
  message: string;
}

export const logsApi = {
  async getDeploymentLogs(
    projectId: string,
    deploymentId: string,
    since?: number
  ): Promise<LogEntry[]> {
    const { data } = await apiClient.get<ApiResponse<LogEntry[]>>(
      `/projects/${projectId}/deployments/${deploymentId}/logs`,
      { params: since ? { since } : {} }
    );
    return data.data ?? [];
  },
};