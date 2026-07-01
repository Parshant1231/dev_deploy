import axios, { AxiosInstance } from 'axios';
import { decryptToken } from './crypto';
import { AppError } from '../errors/AppError';

// ─────────────────────────────────────────────
// GITHUB API CLIENT
//
// Creates an authenticated Axios instance for the
// GitHub REST API v3.
//
// Uses the user's OAuth token (stored encrypted in DynamoDB)
// to authenticate. This means the workflow dispatch is
// triggered as the user who owns the repository — not
// as a generic DevDeploy service account.
// ─────────────────────────────────────────────

export function createGithubClient(encryptedToken: string): AxiosInstance {
  const token = decryptToken(encryptedToken);

  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    timeout: 15000,
  });
}

// ─────────────────────────────────────────────
// TRIGGER WORKFLOW DISPATCH
//
// This is the GitHub API call that starts the
// deploy-user-app.yml workflow in the DevDeploy
// repository when a deployment is created.
//
// workflow_dispatch requires:
//   owner/repo: the DevDeploy repository
//   workflow_id: the filename of the workflow
//   ref: the branch to run the workflow from
//   inputs: the workflow input parameters
// ─────────────────────────────────────────────

export interface WorkflowDispatchInputs {
  deployment_id: string;
  project_id: string;
  repo_full_name: string;
  commit_sha: string;
  environment: string;
  framework: string;
  port: string;
  health_check_path: string;
  cpu: string;
  memory: string;
  api_url: string;
  app_directory: string;
}

export async function triggerWorkflowDispatch(
  githubClient: AxiosInstance,
  params: {
    devdeployRepoOwner: string;
    devdeployRepoName: string;
    inputs: WorkflowDispatchInputs;
  }
): Promise<void> {
  const { devdeployRepoOwner, devdeployRepoName, inputs } = params;

  try {
    await githubClient.post(
      `/repos/${devdeployRepoOwner}/${devdeployRepoName}/actions/workflows/deploy-user-app.yml/dispatches`,
      {
        ref: 'main',
        inputs,
      }
    );

    console.log(`Workflow dispatch triggered for deployment: ${inputs.deployment_id}`);
  } catch (error: any) {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    if (status === 422) {
      throw AppError.badRequest(
        `GitHub workflow dispatch failed: ${message}. ` +
        `Ensure the deploy-user-app.yml workflow exists on the main branch.`
      );
    }

    if (status === 404) {
      throw AppError.notFound(
        `GitHub workflow not found. Ensure deploy-user-app.yml exists in .github/workflows/`
      );
    }

    if (status === 401 || status === 403) {
      throw AppError.unauthorized(
        `GitHub token lacks permission to trigger workflows. ` +
        `Reconnect your GitHub account with workflow scope.`
      );
    }

    throw AppError.internal(
      `GitHub API error (${status}): ${message ?? 'Unknown error'}`
    );
  }
}

// ─────────────────────────────────────────────
// GET REPOSITORY DETAILS
// Validates that the repository exists and is
// accessible with the user's token.
// ─────────────────────────────────────────────

export interface GithubRepository {
  id: number;
  full_name: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  language: string | null;
}

export async function getRepository(
  githubClient: AxiosInstance,
  repoFullName: string
): Promise<GithubRepository> {
  try {
    const response = await githubClient.get<GithubRepository>(
      `/repos/${repoFullName}`
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw AppError.notFound(
        `Repository ${repoFullName} not found or not accessible. ` +
        `Ensure the repository exists and your GitHub account has access.`
      );
    }
    throw error;
  }
}

// ─────────────────────────────────────────────
// LIST USER REPOSITORIES
// Used when a user connects GitHub and selects
// which repository to link to a project.
// ─────────────────────────────────────────────

export async function listUserRepositories(
  githubClient: AxiosInstance,
  page = 1
): Promise<GithubRepository[]> {
  const response = await githubClient.get<GithubRepository[]>(
    '/user/repos',
    {
      params: {
        sort: 'updated',
        per_page: 30,
        page,
        type: 'owner',
      },
    }
  );
  return response.data;
}