// ─────────────────────────────────────────────
// ENTITY TYPES
// These mirror the DynamoDB table schemas from Phase 1.
// ─────────────────────────────────────────────

export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  githubId?: string;
  githubLogin?: string;
  githubToken?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
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
  envVars?: Record<string, string>;
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
  ecsTaskArn?: string;
  ecsServiceArn?: string;
  albDnsName?: string;
  logStreamName?: string;
  buildStartedAt?: string;
  buildFinishedAt?: string;
  deployStartedAt?: string;
  deployFinishedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export type EnvironmentStatus =
  | 'RUNNING'
  | 'IDLE'
  | 'DESTROYING'
  | 'DESTROYED';

export interface Environment {
  environmentId: string;
  projectId: string;
  userId: string;
  name: 'dev' | 'staging' | 'production';
  status: EnvironmentStatus;
  deploymentId?: string;
  ecsServiceArn?: string;
  albDnsName?: string;
  lastActivityAt: string;
  ttlHours: number;
  ttl: number; // Unix timestamp for DynamoDB TTL
  createdAt: string;
  updatedAt: string;
}

export type EventType =
  | 'DEPLOYMENT_CREATED'
  | 'DEPLOYMENT_BUILD_STARTED'
  | 'DEPLOYMENT_BUILD_COMPLETED'
  | 'DEPLOYMENT_BUILD_FAILED'
  | 'DEPLOYMENT_PUSH_STARTED'
  | 'DEPLOYMENT_PUSH_COMPLETED'
  | 'DEPLOYMENT_DEPLOY_STARTED'
  | 'DEPLOYMENT_DEPLOY_COMPLETED'
  | 'DEPLOYMENT_FAILED'
  | 'DEPLOYMENT_CANCELLED'
  | 'DEPLOYMENT_RUNNING'
  | 'ENVIRONMENT_IDLE'
  | 'ENVIRONMENT_DESTROY_REQUESTED'
  | 'ENVIRONMENT_DESTROYING'
  | 'ENVIRONMENT_DESTROYED';

export interface DeploymentEvent {
  eventId: string;
  deploymentId: string;
  projectId: string;
  userId: string;
  type: EventType;
  previousStatus?: string;
  newStatus?: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─────────────────────────────────────────────
// REQUEST TYPES
// Extends Express Request with authenticated user
// ─────────────────────────────────────────────

import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

// ─────────────────────────────────────────────
// RESPONSE TYPES
// Standard API response envelope
// ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    limit: number;
    nextCursor?: string;
  };
}