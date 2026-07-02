// Mirrors the backend types from Phase 3.
// Keeping frontend and backend types in sync manually
// is acceptable at this scale. At larger scale, generate
// these from an OpenAPI spec (Phase 10 consideration).

export interface User {
  userId: string;
  email: string;
  githubId?: string;
  githubLogin?: string;
  avatarUrl?: string;
  createdAt: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface Project {
  projectId: string;
  userId: string;
  name: string;
  description?: string;
  repoFullName?: string;
  repoUrl?: string;
  branch: string;
  framework: 'nodejs' | 'react' | 'nextjs' | 'static';
  buildCommand?: string;
  startCommand?: string;
  port: number;
  createdAt: string;
  updatedAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
}

export type DeploymentStatus =
  | 'PENDING'
  | 'BUILDING'
  | 'PUSHING_IMAGE'
  | 'DEPLOYING'
  | 'RUNNING'
  | 'FAILED'
  | 'CANCELLED'
  | 'DESTROYED';

export interface Deployment {
  deploymentId: string;
  projectId: string;
  userId: string;
  environment: 'dev' | 'staging' | 'production';
  status: DeploymentStatus;
  commitSha?: string;
  commitMessage?: string;
  branch: string;
  imageUri?: string;
  albDnsName?: string;
  errorMessage?: string;
  buildStartedAt?: string;
  buildFinishedAt?: string;
  deployStartedAt?: string;
  deployFinishedAt?: string;
  createdAt: string;
}

export type EnvironmentStatus = 'RUNNING' | 'IDLE' | 'DESTROYING' | 'DESTROYED';

export interface Environment {
  environmentId: string;
  projectId: string;
  userId: string;
  name: 'dev' | 'staging' | 'production';
  status: EnvironmentStatus;
  deploymentId?: string;
  albDnsName?: string;
  lastActivityAt: string;
  ttlHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentEvent {
  eventId: string;
  deploymentId: string;
  projectId: string;
  type: string;
  previousStatus?: string;
  newStatus?: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface GithubRepository {
  id: number;
  full_name: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  language: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}