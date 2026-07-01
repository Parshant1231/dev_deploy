import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Check your .env file or ECS task environment variables.`
    );
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  // Application
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '3001'), 10),
  isProduction: process.env.NODE_ENV === 'production',

  // JWT
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: optionalEnv('JWT_EXPIRES_IN', '7d'),

  // GitHub OAuth
  githubClientId: optionalEnv('GITHUB_CLIENT_ID', ''),
  githubClientSecret: optionalEnv('GITHUB_CLIENT_SECRET', ''),
  githubWebhookSecret: optionalEnv('GITHUB_WEBHOOK_SECRET', ''),

  // AWS
  awsRegion: optionalEnv('AWS_REGION', 'us-east-1'),
  awsAccountId: optionalEnv('AWS_ACCOUNT_ID', ''),

  // DynamoDB Tables
  tables: {
    users: requireEnv('DYNAMODB_USERS_TABLE'),
    projects: requireEnv('DYNAMODB_PROJECTS_TABLE'),
    deployments: requireEnv('DYNAMODB_DEPLOYMENTS_TABLE'),
    environments: requireEnv('DYNAMODB_ENVIRONMENTS_TABLE'),
    events: requireEnv('DYNAMODB_EVENTS_TABLE'),
  },

  // AWS Resources
  ecsCluster: optionalEnv('ECS_CLUSTER', 'devdeploy-dev-cluster'),
  ecrRegistry: optionalEnv('ECR_REGISTRY', ''),
  s3ArtifactsBucket: optionalEnv('S3_ARTIFACTS_BUCKET', ''),

  // Frontend URL for CORS
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),

  // EventBridge
  eventBridgeBusName: optionalEnv('EVENTBRIDGE_BUS_NAME', 'devdeploy-dev-events'),

  // GitHub — DevDeploy repository (where workflows live)
  devdeployRepoOwner: requireEnv('DEVDEPLOY_REPO_OWNER'),
  devdeployRepoName: optionalEnv('DEVDEPLOY_REPO_NAME', 'devdeploy'),

  // Public API URL (sent to GitHub Actions as api_url input)
  apiPublicUrl: requireEnv('API_PUBLIC_URL'),

  // Retry configuration
  maxDeploymentRetries: parseInt(optionalEnv('MAX_DEPLOYMENT_RETRIES', '3'), 10),
  retryBaseDelayMs: parseInt(optionalEnv('RETRY_BASE_DELAY_MS', '30000'), 10),

} as const;