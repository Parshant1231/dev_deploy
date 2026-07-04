# DevDeploy — Platform as a Service for Deploying Applications

A self-service deployment platform similar to Render, Railway, and Vercel. Connect a GitHub repository, and DevDeploy automatically builds Docker images, pushes them to AWS ECR, and deploys to AWS ECS with a single click.

---

## Table of Contents

1. [What is DevDeploy?](#what-is-devdeploy)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
   - [Prerequisites](#prerequisites)
   - [Local Development Setup](#local-development-setup)
   - [Deploy to AWS](#deploy-to-aws)
4. [Security Setup](#security-setup)
5. [Complete Workflow](#complete-workflow)
6. [Troubleshooting](#troubleshooting)

---

## What is DevDeploy?

DevDeploy is a deployment orchestration platform that:

- **Connects to GitHub** — OAuth integration to authenticate users
- **Manages Projects** — Users create projects linked to GitHub repositories
- **Orchestrates Deployments** — Triggers build pipelines via GitHub Actions
- **Builds & Pushes** — Automatically builds Docker images and pushes to AWS ECR
- **Deploys to ECS** — Deploys containers to AWS ECS Fargate with load balancing
- **Manages Secrets** — Stores encryption keys and OAuth credentials in AWS Secrets Manager
- **Provides Dashboard** — Web UI to view projects, deployments, and metrics

**Tech Stack:**
- **Frontend:** Next.js + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Infrastructure:** AWS (ECS, ECR, DynamoDB, Secrets Manager, ALB, Lambda)
- **IaC:** Terraform
- **CI/CD:** GitHub Actions
- **Databases:** DynamoDB for persistent data storage

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     DevDeploy Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐                    │
│  │   Frontend   │────────▶│  Backend API │                    │
│  │  (Next.js)   │         │  (Express)   │                    │
│  └──────────────┘         └──────────────┘                    │
│                                  │                             │
│                    ┌─────────────┼─────────────┐               │
│                    │             │             │               │
│                    ▼             ▼             ▼               │
│            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│            │  DynamoDB    │ │   Secrets    │ │  Eventbridge │ │
│            │  (Users,     │ │  Manager     │ │  (Events)    │ │
│            │  Projects,   │ │ (Encrypted   │ │              │ │
│            │  Deployments)│ │  Secrets)    │ │              │ │
│            └──────────────┘ └──────────────┘ └──────────────┘ │
│                                  │                             │
│        ┌────────────────────────┴────────────────────────┐    │
│        │   GitHub Actions Workflow (CI/CD Pipeline)      │    │
│        │  ┌──────────────────────────────────────────┐  │    │
│        │  │ 1. Build Docker image                    │  │    │
│        │  │ 2. Push to ECR                           │  │    │
│        │  │ 3. Update ECS task definition            │  │    │
│        │  │ 4. Deploy to ECS Fargate                 │  │    │
│        │  │ 5. Report status back to API             │  │    │
│        │  └──────────────────────────────────────────┘  │    │
│        └──────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         AWS Infrastructure (Terraform)                  │  │
│  │                                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │     ALB      │  │   ECS        │  │     ECR      │  │  │
│  │  │ (Load        │─▶│  (Container  │◀─│  (Image      │  │  │
│  │  │  Balancer)   │  │  Orchestrator)  │  Registry)   │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

**System Requirements:**
- Node.js 18+ (`node --version`)
- npm or yarn
- AWS CLI v2 (`aws --version`)
- Terraform 1.5+ (`terraform --version`)
- Git
- Docker (for local testing)

**AWS Account Setup:**
- AWS account with AdministratorAccess or equivalent permissions
- AWS credentials configured (`aws configure`)
- AWS region: `us-east-1` (or update in code as needed)

**GitHub Setup:**
- GitHub account with repo access
- GitHub OAuth App created (see [Security Setup](#security-setup))

---

### Local Development Setup

#### Step 1: Clone the Repository

```bash
git clone https://github.com/Parshant1231/dev_deploy.git
cd dev_deploy
```

#### Step 2: Install Backend Dependencies

```bash
cd apps/backend
npm install
```

Create a `.env` file in `apps/backend/`:

```bash
cp .env.example .env
```

Update `.env` with your local values:

```env
NODE_ENV=development
PORT=3001

# JWT Secret (use a strong random value)
JWT_SECRET=$(openssl rand -hex 64)
JWT_EXPIRES_IN=7d

# GitHub OAuth (get these from GitHub Developer Settings)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret

# DynamoDB Tables (local or AWS)
DYNAMODB_USERS_TABLE=devdeploy-users
DYNAMODB_PROJECTS_TABLE=devdeploy-projects
DYNAMODB_DEPLOYMENTS_TABLE=devdeploy-deployments
DYNAMODB_ENVIRONMENTS_TABLE=devdeploy-environments
DYNAMODB_EVENTS_TABLE=devdeploy-events

# Encryption Key (for storing GitHub tokens)
TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)

# API Configuration
INTERNAL_API_KEY=$(openssl rand -hex 32)
```

#### Step 3: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

Create a `.env.local` file in `apps/frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
```

#### Step 4: Start Local Database (DynamoDB)

Option A — Using Docker Compose:

```bash
cd /path/to/dev_deploy
docker-compose up -d dynamodb
```

Option B — Using AWS DynamoDB local:

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
```

#### Step 5: Run the Backend

```bash
cd apps/backend
npm run dev
```

Expected output:
```
[ts-node-dev] v2.0.0
[info] ts-node-dev ver. 2.0.0
[info] listening on port 3001
```

#### Step 6: Run the Frontend (in another terminal)

```bash
cd apps/frontend
npm run dev
```

Expected output:
```
▲ Next.js 14.2.15
- Local:        http://localhost:3000
```

#### Step 7: Test Local Setup

**Backend Health Check:**
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "devdeploy-api",
  "timestamp": "2026-07-04T18:00:00Z"
}
```

**Register a User:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"Password123!",
    "name":"Test User"
  }'
```

**Access Frontend:**
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Deploy to AWS

#### Step 1: Set Up AWS Infrastructure with Terraform

Navigate to the Terraform directory:

```bash
cd infrastructure/terraform/environments/dev
```

Initialize Terraform:

```bash
terraform init
```

Generate strong secret values:

```bash
echo "JWT_SECRET: $(openssl rand -hex 64)"
echo "TOKEN_ENCRYPTION_KEY: $(openssl rand -hex 32)"
echo "GITHUB_CLIENT_ID: (get from GitHub Developer Settings)"
echo "GITHUB_CLIENT_SECRET: (get from GitHub Developer Settings)"
echo "DEVDEPLOY_GITHUB_TOKEN: (create a PAT)"
```

Create `secrets.auto.tfvars` (this file is gitignored):

```bash
cat > secrets.auto.tfvars <<EOF
jwt_secret_value           = "your_jwt_secret_here"
token_encryption_key_value = "your_encryption_key_here"
github_client_id           = "your_github_client_id"
github_client_secret       = "your_github_client_secret"
devdeploy_github_token     = "your_github_pat_token"
EOF
```

**Important:** Add to `.gitignore` (already done):
```bash
**/secrets.auto.tfvars
```

#### Step 2: Plan and Apply Terraform

```bash
# Review the plan
terraform plan -var-file=secrets.auto.tfvars

# Apply the infrastructure
terraform apply -var-file=secrets.auto.tfvars
```

Terraform will create:
- **AWS Secrets Manager** — Encrypted secret storage
- **VPC & Networking** — Security groups, subnets, route tables
- **IAM Roles & Policies** — Permissions for ECS, Lambda, DynamoDB
- **ECS Cluster & Services** — Container orchestration
- **DynamoDB Tables** — Data persistence
- **Application Load Balancer (ALB)** — Traffic routing
- **ECR Repository** — Docker image registry
- **CloudWatch Logs** — Log aggregation

After apply completes, you'll see outputs like:

```
alb_dns_name = "devdeploy-dev-alb-xxx.us-east-1.elb.amazonaws.com"
api_url = "http://devdeploy-dev-alb-xxx.us-east-1.elb.amazonaws.com/api/v1"
```

#### Step 3: Verify Infrastructure

```bash
# Check ECS service status
aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1

# Check task health
aws ecs describe-tasks \
  --cluster devdeploy-dev-cluster \
  --tasks $(aws ecs list-tasks --cluster devdeploy-dev-cluster --region us-east-1 --query 'taskArns[0]' --output text) \
  --region us-east-1 \
  --query 'tasks[0].{status:lastStatus, health:healthStatus}'
```

#### Step 4: Deploy Backend to ECS

Build and push Docker image to ECR:

```bash
# Get ECR repository URI from Terraform output
ECR_URI=$(terraform output -raw ecr_repository_url)

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="us-east-1"

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build Docker image
cd ../../.. # go back to project root
docker build -f .github/dockerfiles/backend.Dockerfile \
  -t $ECR_URI:latest \
  -t $ECR_URI:$(git rev-parse --short HEAD) \
  .

# Push to ECR
docker push $ECR_URI:latest
docker push $ECR_URI:$(git rev-parse --short HEAD)
```

#### Step 5: Update ECS Service

```bash
# Force a new deployment with the latest image
aws ecs update-service \
  --cluster devdeploy-dev-cluster \
  --service devdeploy-dev-api-service \
  --region us-east-1 \
  --force-new-deployment
```

Monitor the deployment:

```bash
# Watch deployment progress
aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1 \
  --query 'services[0].deployments[*].{status:status, running:runningCount, desired:desiredCount}'
```

#### Step 6: Test AWS Deployment

```bash
ALB_DNS=$(terraform output -raw alb_dns_name)

# Health check
curl http://$ALB_DNS/health

# Register a user
curl -X POST http://$ALB_DNS/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'

# View logs
aws logs tail /devdeploy/dev/api --region us-east-1 --follow
```

---

## Security Setup

### 1. Generate Strong Secret Values

**Never** commit secrets to version control. Always generate and store them securely:

```bash
# Generate secrets
JWT_SECRET=$(openssl rand -hex 64)
TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
INTERNAL_API_KEY=$(openssl rand -hex 32)

echo "JWT_SECRET=$JWT_SECRET"
echo "TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY"
echo "INTERNAL_API_KEY=$INTERNAL_API_KEY"
```

### 2. Store Secrets in AWS Secrets Manager

Terraform automatically stores secrets in AWS Secrets Manager with KMS encryption:

```bash
# Verify secrets are encrypted
aws secretsmanager list-secrets \
  --region us-east-1 \
  --query 'SecretList[?contains(Name,`devdeploy`)].{Name:Name, KMS:KmsKeyId}'
```

### 3. Create GitHub OAuth App

1. Go to GitHub → Settings → Developer Settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name:** DevDeploy
   - **Homepage URL:** `http://localhost:3000` (local) or your ALB DNS (production)
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback` (local)
4. Copy **Client ID** and **Client Secret** to your environment variables

### 4. Create GitHub Personal Access Token (PAT)

For triggering workflows from the backend:

1. GitHub → Settings → Developer Settings → Personal Access Tokens (Classic)
2. Click "Generate new token"
3. Select scopes: `repo`, `workflow`
4. Copy token and add to `secrets.auto.tfvars` as `devdeploy_github_token`

### 5. IAM Best Practices

The Terraform configuration creates IAM roles with least-privilege access:

- **ECS Task Role** — Permissions to access DynamoDB, Secrets Manager, ECR, EventBridge
- **ECS Execution Role** — Permissions to pull images, write logs, retrieve secrets
- **Lambda Role** — Permissions to invoke other Lambdas and write logs

Review IAM policies:

```bash
aws iam list-attached-role-policies \
  --role-name devdeploy-dev-ecs-task-role \
  --region us-east-1
```

### 6. .gitignore Configuration

Ensure sensitive files are never committed:

```bash
# Backend environment
apps/backend/.env
apps/backend/.env.local
apps/backend/.env.*.local

# Frontend environment
apps/frontend/.env.local
apps/frontend/.env.*.local

# Terraform secrets
**/secrets.auto.tfvars
**/terraform.tfstate*

# AWS credentials
~/.aws/credentials
~/.aws/config

# SSH keys
*.pem
*.key
```

---

## Complete Workflow

### User Journey (End-to-End)

#### Step 1: User Creates Account

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "John Doe"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "userId": "usr_abc123",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Step 2: User Connects GitHub

Frontend redirects to:
```
https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/auth/callback&scope=repo,workflow
```

Backend exchanges OAuth code for access token and stores encrypted in DynamoDB.

#### Step 3: User Creates a Project

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3001/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Web App",
    "repoFullName": "username/my-web-app",
    "framework": "nodejs",
    "port": 3000,
    "branch": "main"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "projectId": "prj_xyz789",
    "name": "My Web App",
    "status": "active"
  }
}
```

#### Step 4: User Triggers Deployment

```bash
curl -X POST http://localhost:3001/api/v1/projects/prj_xyz789/deployments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "environment": "dev",
    "commitSha": "abc123def456",
    "commitMessage": "feat: new feature"
  }'
```

This creates a **deployment record** with status `PENDING`.

#### Step 5: GitHub Actions Workflow Triggers

Backend sends webhook to GitHub Actions:
- Pulls the commit
- Builds Docker image with `commitSha` as tag
- Pushes image to ECR
- Calls backend API to update deployment status

#### Step 6: Backend Updates Deployment Status

GitHub Actions makes authenticated calls using `DEVDEPLOY_INTERNAL_KEY`:

```bash
# PENDING → BUILDING
curl -X PATCH http://localhost:3001/api/v1/projects/prj_xyz789/deployments/dep_abc123/status \
  -H "X-Internal-Key: $INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "BUILDING"}'

# BUILDING → PUSHING_IMAGE
# PUSHING_IMAGE → DEPLOYING
# DEPLOYING → RUNNING (with ALB DNS)
```

#### Step 7: User Views Live Deployment

Frontend polls `/deployments/dep_abc123`:

```json
{
  "success": true,
  "data": {
    "deploymentId": "dep_abc123",
    "status": "RUNNING",
    "deployedUrl": "http://prj-my-web-app-dev.devdeploy-dev-alb-xxx.us-east-1.elb.amazonaws.com",
    "createdAt": "2026-07-04T18:00:00Z",
    "completedAt": "2026-07-04T18:10:00Z"
  }
}
```

User can access deployed application at the provided URL.

---

## Troubleshooting

### Backend Won't Start

**Error:** `Port 3001 already in use`

```bash
# Find process using port 3001
lsof -i :3001

# Kill it
kill -9 <PID>

# Or use a different port
PORT=3002 npm run dev
```

**Error:** `Cannot find module '@aws-sdk/...'`

```bash
cd apps/backend
npm install
npm run build
```

### Frontend Can't Connect to Backend

**Error:** `CORS error` or `Failed to fetch`

1. Verify backend is running: `curl http://localhost:3001/health`
2. Check `NEXT_PUBLIC_API_URL` in `apps/frontend/.env.local`
3. Verify CORS is configured in backend (check `src/middleware/cors.ts`)

### AWS Deployment Issues

**ECS tasks not starting:**

```bash
# Check task logs
aws ecs describe-tasks \
  --cluster devdeploy-dev-cluster \
  --tasks <TASK_ARN> \
  --region us-east-1 \
  --query 'tasks[0].containers[0].{reason:reason, exitCode:exitCode}'

# View CloudWatch logs
aws logs tail /devdeploy/dev/api --region us-east-1 --follow
```

**Secrets not being injected:**

```bash
# Verify IAM permissions
aws iam list-attached-role-policies \
  --role-name devdeploy-dev-ecs-execution-role

# Check Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id devdeploy-dev-app-secrets \
  --region us-east-1
```

**ALB health checks failing:**

```bash
# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn <ARN> \
  --region us-east-1
```

### Database Connection Issues

**Error:** `Could not connect to DynamoDB`

```bash
# For local development, ensure Docker container is running
docker ps | grep dynamodb

# If not running:
docker-compose up -d dynamodb

# Test connection
aws dynamodb list-tables --endpoint-url http://localhost:8000
```

**Error:** `Table does not exist`

```bash
# For local DynamoDB, create tables:
aws dynamodb create-table \
  --table-name devdeploy-users \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000
```

### GitHub Integration Issues

**Error:** `GitHub token invalid or expired`

1. Verify token has `repo` and `workflow` scopes
2. Token has not been rotated or revoked
3. Run: `curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user`

**Error:** `Webhook not registered`

1. Check GitHub repository settings → Webhooks
2. Verify webhook URL points to correct ALB DNS
3. Check webhook delivery logs for failures

---

## Additional Documentation

For detailed information, see:

- **Architecture Decisions:** `/docs/architecture/`
- **Database Schema:** `/docs/architecture/database.md`
- **Deployment State Machine:** `/docs/architecture/deployment_states.md`
- **API Testing Reference:** `/API_TESTING.md`
- **Infrastructure as Code:** `/infrastructure/terraform/`

---

## Support & Contributions

For issues, feature requests, or contributions:

1. Check existing GitHub issues
2. Create a new issue with detailed reproduction steps
3. Submit a pull request with tests and documentation

---

## License

MIT License — See LICENSE file for details.

---

**Last Updated:** July 4, 2026
**Maintainer:** DevDeploy Team