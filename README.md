# DevDeploy

A self-service application deployment platform.

Connect a GitHub repository. Deploy to AWS automatically.

---

## What is DevDeploy?

DevDeploy is a deployment platform similar to Render, Railway, and Vercel.
Developers connect their GitHub repositories and DevDeploy handles
building Docker images, pushing to ECR, and deploying to ECS on AWS.

---

## Architecture

- **Frontend:** Next.js + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Infrastructure:** AWS + Terraform
- **CI/CD:** GitHub Actions + Docker
- **Database:** DynamoDB
- **Container Runtime:** ECS Fargate
- **Container Registry:** ECR
- **Load Balancer:** ALB

---

## Project Structure

devdeploy/

├── apps/

│   ├── frontend/     # Next.js dashboard

│   └── backend/      # Node.js API

├── infrastructure/

│   ├── terraform/    # AWS infrastructure

│   └── docker/       # Dockerfiles

├── .github/

│   └── workflows/    # GitHub Actions

└── docs/             # Architecture and decisions

---

## Development Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation and System Design | ✅ Complete |
| 2 | Terraform Infrastructure | ⏳ Pending |
| 3 | Core Backend Platform | ⏳ Pending |
| 4 | GitHub Integration and CI/CD | ⏳ Pending |
| 5 | Container Platform | ⏳ Pending |
| 6 | Deployment Orchestrator | ⏳ Pending |
| 7 | Auto-Destroy System | ⏳ Pending |
| 8 | Frontend Dashboard | ⏳ Pending |
| 9 | Observability and Monitoring | ⏳ Pending |
| 10 | Security Hardening and Scale | ⏳ Pending |

---

## Documentation

See the `/docs` folder for:
- Architecture decisions
- Database schema
- Deployment state machine
- System diagrams
