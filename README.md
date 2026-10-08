# DevDeploy

DevDeploy is a self-service application deployment platform that connects GitHub repositories to AWS and automates the path from source code to a running containerized application.

It provides a developer-friendly workflow for configuring applications, building Docker images, publishing them to Amazon ECR, deploying them to Amazon ECS Fargate, and monitoring deployment activity from a web dashboard.

## Features

- GitHub repository integration
- Declarative application configuration with `devdeploy.yml`
- Automated build and deployment workflows using GitHub Actions
- Docker image builds and Amazon ECR publishing
- Amazon ECS Fargate deployments behind an Application Load Balancer
- Deployment orchestration and status tracking
- Automatic cleanup and destroy workflows
- Frontend dashboard for managing applications and deployments
- Authentication, authorization, validation, and secure API middleware
- AWS observability using CloudWatch and related services
- Infrastructure as code managed with Terraform

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Infrastructure | AWS and Terraform |
| CI/CD | GitHub Actions and Docker |
| Database | Amazon DynamoDB |
| Container runtime | Amazon ECS Fargate |
| Container registry | Amazon ECR |
| Load balancing | Application Load Balancer |
| Events and automation | Amazon EventBridge and AWS Lambda |
| Monitoring | Amazon CloudWatch and CloudWatch Logs |

## How It Works

1. A user connects a GitHub repository through the DevDeploy dashboard.
2. DevDeploy reads the repository configuration and validates the deployment settings.
3. A GitHub Actions workflow builds the application container image.
4. The image is pushed to Amazon ECR.
5. DevDeploy provisions or updates the required ECS service and task definition.
6. The application is deployed to ECS Fargate and exposed through the configured load balancer.
7. Deployment state, logs, and operational events are recorded for monitoring.
8. Cleanup workflows can remove temporary or inactive deployment resources.

## Project Structure

```text
.
├── apps/
│   ├── backend/             # Express API and deployment services
│   ├── frontend/            # Next.js management dashboard
│   └── sample-app/          # Sample application used for deployment testing
├── infrastructure/
│   ├── lambda/              # Lambda functions for platform automation
│   └── terraform/
│       ├── bootstrap/       # Terraform bootstrap resources
│       ├── environments/    # Environment-specific configuration
│       └── modules/         # Reusable AWS infrastructure modules
├── .github/
│   └── workflows/           # Backend and user-application deployment workflows
├── docs/
│   └── architecture/       # Architecture specifications and design documentation
├── docker-compose.yml       # Local orchestration configuration
└── .env.example             # Environment variable template
```

## Development Status

All planned DevDeploy implementation phases are complete:

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation and System Design | ✅ Complete |
| 2 | Terraform Infrastructure | ✅ Complete |
| 3 | Core Backend Platform | ✅ Complete |
| 4 | GitHub Integration and CI/CD | ✅ Complete |
| 5 | Container Platform | ✅ Complete |
| 6 | Deployment Orchestrator | ✅ Complete |
| 7 | Auto-Destroy System | ✅ Complete |
| 8 | Frontend Dashboard | ✅ Complete |
| 9 | Observability and Monitoring | ✅ Complete |
| 10 | Security Hardening and Scale | ✅ Complete |

## Prerequisites

- Node.js and npm
- Docker
- Terraform
- An AWS account with permissions for the required services
- A GitHub account and repository access
- AWS credentials configured for local development or CI/CD

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Parshant1231/dev_deploy.git
cd dev_deploy
```

### 2. Configure environment variables

Copy the example environment file and provide the values required by your environment:

```bash
cp .env.example .env
```

Do not commit access tokens, passwords, private keys, or other secrets to the repository. Store production credentials in GitHub Actions secrets, AWS Secrets Manager, or another approved secrets manager.

### 3. Install dependencies

Install dependencies for both applications:

```bash
cd apps/backend
npm install

cd ../frontend
npm install
```

### 4. Run the backend

```bash
cd apps/backend
npm run dev
```

The backend also supports:

```bash
npm run build
npm start
npm run lint
npm run typecheck
```

### 5. Run the frontend

```bash
cd apps/frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Infrastructure

Terraform configuration is organized into reusable modules for networking, security, storage, compute, Lambda automation, and monitoring. Review the environment-specific configuration before applying infrastructure changes.

```bash
cd infrastructure/terraform
terraform init
terraform validate
terraform plan
terraform apply
```

Run Terraform only after configuring AWS credentials and reviewing the target environment, region, and state backend settings.

## CI/CD Workflows

The repository includes GitHub Actions workflows for:

- Deploying the DevDeploy backend
- Building and deploying user applications
- Building Docker images
- Publishing images to Amazon ECR
- Updating ECS services and deployment resources

Workflow files are located in `.github/workflows/`.

## Application Configuration

Applications can define their deployment settings using the DevDeploy configuration format documented in [`docs/architecture/DEVDEPLOY_YML_SPEC.md`](docs/architecture/DEVDEPLOY_YML_SPEC.md).

The configuration describes the application build and runtime requirements used by the deployment pipeline.

## Documentation

Additional project documentation is available in the [`docs`](docs) directory, including:

- Architecture specifications
- The `devdeploy.yml` configuration format
- Database and deployment design information
- Deployment state and workflow documentation
- System diagrams and architectural decisions

## Security

- Keep `.env` files and credentials out of version control.
- Use GitHub Actions secrets or AWS-managed secret storage for CI/CD credentials.
- Apply least-privilege permissions to AWS and GitHub integrations.
- Review Terraform plans before applying changes.
- Rotate credentials immediately if they are accidentally exposed.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
