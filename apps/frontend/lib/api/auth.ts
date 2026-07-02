import { apiClient } from './client';
import { User, ApiResponse } from '@/types';

export interface AuthResult {
  user: User;
  token: string;
}

export const authApi = {
  async register(email: string, password: string): Promise<AuthResult> {
    const { data } = await apiClient.post<ApiResponse<AuthResult>>(
      '/auth/register',
      { email, password }
    );
    return data.data!;
  },

  async login(email: string, password: string): Promise<AuthResult> {
    const { data } = await apiClient.post<ApiResponse<AuthResult>>(
      '/auth/login',
      { email, password }
    );
    return data.data!;
  },

  async getMe(): Promise<User> {
    const { data } = await apiClient.get<ApiResponse<User>>('/auth/me');
    return data.data!;
  },

  async connectGithub(code: string): Promise<User> {
    const { data } = await apiClient.post<ApiResponse<User>>(
      '/auth/github/connect',
      { code }
    );
    return data.data!;
  },

  async disconnectGithub(): Promise<void> {
    await apiClient.delete('/auth/github/disconnect');
  },

  async connectGithubPat(token: string): Promise<User> {
    const { data } = await apiClient.post<ApiResponse<{ githubUsername: string; githubId: string }>>(
      '/auth/github/connect-pat',
      { token }
    );
    // Re-fetch the full user after PAT connect
    const me = await apiClient.get<ApiResponse<User>>('/auth/me');
    return me.data.data!;
  },

  async listGithubRepos(): Promise<import('@/types').GithubRepository[]> {
    const { data } = await apiClient.get<ApiResponse<import('@/types').GithubRepository[]>>(
      '/auth/github/repos'
    );
    return data.data ?? [];
  },
};