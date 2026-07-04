# DevDeploy AWS Deployment Guide

Complete guide to deploying DevDeploy to AWS using Terraform and GitHub Actions.

**⏱️ Estimated time: 2-3 hours for complete production deployment**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Terraform Setup](#terraform-setup)
4. [Infrastructure Provisioning](#infrastructure-provisioning)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring & Logging](#monitoring--logging)
9. [Cost Optimization](#cost-optimization)
10. [Scaling & Performance](#scaling--performance)

---

## Prerequisites

### AWS Account Setup

```bash
# 1. Verify AWS CLI is configured
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "AIDAI...",
#     "Account": "123456789",
#     "Arn": "arn:aws:iam::123456789:user/your-name"
# }

# 2. Verify AWS credentials have required permissions
aws ec2 describe-regions --output table

# 3. Verify region is set correctly
aws configure get region  # Should be us-east-1 (or your chosen region)
```

### Local Tools

```bash
# Verify all required tools
node --version        # v18+
npm --version         # v9+
git --version
aws --version         # AWS CLI v2+
terraform --version   # v1.3+
docker --version      # 20.0+
```

### AWS Permissions Required

Your IAM user/role needs permissions for:

- EC2 (VPC, subnets, security groups)
- ECS (clusters, services, task definitions)
- ALB (load balancers, target groups)
- DynamoDB (tables, streams)
- RDS (if using database)
- ECR (container registry)
- CloudWatch (logs, metrics, alarms)
- IAM (roles, policies)
- Secrets Manager
- Terraform state S3 bucket

---

## Architecture Overview

### AWS Resources Created

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │   ALB    │ (Application Load Balancer)
                    │ (Port 443)
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼──┐        ┌───▼──┐        ┌───▼──┐
    │ ECS  │        │ ECS  │        │ ECS  │
    │Task  │        │Task  │        │Task  │
    │ (AZ1)│        │ (AZ2)│        │ (AZ3)│
    └───┬──┘        └───┬──┘        └───┬──┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                    ┌────▼──────────┐
                    │  DynamoDB     │
                    │  (Multi-AZ)   │
                    └───────────────┘

                    Secrets Manager
                    IAM Roles
                    CloudWatch Logs
                    EventBridge
```

### Resource List

| Resource | Count | Purpose |
|----------|-------|---------|
| VPC | 1 | Network isolation |
| Subnets | 3 (private) + 3 (public) | Availability zones |
| Security Groups | 3 | ALB, ECS, database |
| ECS Cluster | 1 | Container orchestration |
| ECS Service | 1 | Manages backend tasks |
| ECS Tasks | 3 (auto-scaling) | Running containers |
| ALB | 1 | HTTP/HTTPS routing |
| Target Groups | 1 | Route traffic to ECS |
| ECR Repository | 1 | Docker image storage |
| DynamoDB Tables | 6 | Data storage |
| Secrets Manager | 1 | Secret storage |
| IAM Roles | 2 | Permissions |
| CloudWatch Log Groups | 3 | Logs & monitoring |

---

## Terraform Setup

### 1. Understand Terraform Structure

```
infrastructure/terraform/
├── modules/                    # Reusable components
│   ├── networking/            # VPC, subnets, security groups
│   ├── compute/               # ECS, ALB, auto-scaling
│   ├── database/              # DynamoDB tables
│   ├── security/              # IAM roles, Secrets Manager
│   └── observability/         # CloudWatch, monitoring
├── environments/
│   └── dev/                   # Development environment
│       ├── main.tf            # Resource definitions
│       ├── variables.tf       # Input variables
│       ├── outputs.tf         # Output values
│       ├── terraform.tfvars   # Environment-specific values
│       └── secrets.auto.tfvars # Secrets (NEVER commit)
└── backend.tf                 # Terraform state (S3 + DynamoDB)
```

### 2. Initialize Terraform

```bash
# Navigate to environment
cd infrastructure/terraform/environments/dev

# Initialize Terraform (download providers, setup state)
terraform init

# Expected output:
# Terraform has been successfully configured!
# You can now begin working with Terraform.
```

### 3. Validate Terraform Configuration

```bash
# Validate syntax and logic
terraform validate

# Expected output:
# Success! The configuration is valid.

# Format files correctly
terraform fmt -recursive

# List all resources that will be created
terraform plan -var-file=secrets.auto.tfvars > tfplan.txt
cat tfplan.txt | grep "Plan:"
```

---

## Infrastructure Provisioning

### 1. Create Secrets File

**Generate strong values:**

```bash
# Generate secrets
JWT_SECRET=$(openssl rand -hex 64)
TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
GITHUB_TOKEN="ghp_your-personal-access-token"
GITHUB_CLIENT_ID="your-oauth-app-id"
GITHUB_CLIENT_SECRET="your-oauth-app-secret"

echo "Save these values:"
echo "JWT_SECRET=$JWT_SECRET"
echo "TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY"
```

**Create secrets file:**

```bash
cd infrastructure/terraform/environments/dev

cat > secrets.auto.tfvars << 'EOF'
jwt_secret_value           = "your-generated-jwt-secret-hex-64-chars"
token_encryption_key_value = "your-generated-token-key-hex-32-chars"
devdeploy_github_token     = "ghp_your-personal-access-token"
github_client_id           = "your-oauth-app-id"
github_client_secret       = "your-oauth-app-secret"
EOF

# ✅ IMPORTANT: Verify it's in .gitignore
grep "secrets.auto.tfvars" ../../.gitignore

# If not present, add it
echo "**/secrets.auto.tfvars" >> ../../.gitignore
```

### 2. Plan Infrastructure Changes

```bash
cd infrastructure/terraform/environments/dev

# Review all resources that will be created
terraform plan -var-file=secrets.auto.tfvars

# Save plan to file for review
terraform plan -var-file=secrets.auto.tfvars -out=tfplan

# Shows:
# Plan: 45 to add, 0 to change, 0 to destroy.
```

### 3. Apply Terraform Configuration

```bash
cd infrastructure/terraform/environments/dev

# Apply infrastructure changes
# ⏱️ This takes 10-15 minutes
terraform apply -var-file=secrets.auto.tfvars -auto-approve

# Or review and confirm manually
terraform apply -var-file=secrets.auto.tfvars
# Type 'yes' when prompted

# Expected output:
# Apply complete! Resources: 45 added, 0 changed, 0 destroyed.
```

### 4. Verify Infrastructure

```bash
# Get outputs (ALB DNS, ECR repo, etc.)
terraform output -json > infrastructure-outputs.json
cat infrastructure-outputs.json | jq

# Save important values:
ALB_DNS=$(terraform output -raw alb_dns_name)
ECR_REPO=$(terraform output -raw ecr_repository_url)

echo "ALB DNS: $ALB_DNS"
echo "ECR Repository: $ECR_REPO"
```

### 5. Store Outputs

```bash
# Save outputs to file for reference
cat > ../../../INFRASTRUCTURE_OUTPUTS.txt << EOF
ALB DNS: $ALB_DNS
ECR Repository: $ECR_REPO
ECS Cluster: devdeploy-dev-cluster
VPC ID: $(terraform output -raw vpc_id)
Database: devdeploy-dynamodb-*
Secrets Manager: devdeploy-dev-*-secret

Last deployment: $(date)
EOF

echo "✅ Outputs saved to INFRASTRUCTURE_OUTPUTS.txt"
```

---

## Backend Deployment

### 1. Build Docker Image

```bash
cd apps/backend

# Build image
docker build -t devdeploy-api:latest .

# Expected output:
# Step 1/10 : FROM node:18-alpine
# ...
# Successfully built abc123...

# Verify image
docker images | grep devdeploy-api
# devdeploy-api  latest  abc123...  47 seconds ago  ...
```

### 2. Push to ECR

```bash
# Get ECR repo URL (from Terraform outputs or manually)
ECR_REPO_URL="123456789.dkr.ecr.us-east-1.amazonaws.com/devdeploy-api"

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_REPO_URL

# Tag image for ECR
docker tag devdeploy-api:latest $ECR_REPO_URL:latest

# Push to ECR
docker push $ECR_REPO_URL:latest

# Verify
aws ecr describe-images \
  --repository-name devdeploy-api \
  --region us-east-1 \
  --query 'imageDetails[*].{Tags:imageTags,Size:imageSizeBytes}'
```

### 3. Deploy to ECS

```bash
# Get current task definition
TASK_DEF=$(aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1 \
  --query 'services[0].taskDefinition' \
  --output text)

echo "Current task definition: $TASK_DEF"

# Update service to use new image
aws ecs update-service \
  --cluster devdeploy-dev-cluster \
  --service devdeploy-dev-api-service \
  --region us-east-1 \
  --force-new-deployment

# Monitor deployment
aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1 \
  --query 'services[0].deployments[*].{Status:status,Running:runningCount,Desired:desiredCount,Updated:updatedAt}'
```

### 4. Monitor Deployment

```bash
# Watch deployment progress
watch -n 5 'aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1 \
  --query "services[0].{Status:status,Deployments:deployments[*].{status:status,running:runningCount,desired:desiredCount}}" \
  --output table'

# Or check logs
aws logs tail /devdeploy/dev/api --region us-east-1 --follow

# Expected:
# 2026-07-04T18:30:45.000Z [INFO] Server started on port 3001
# 2026-07-04T18:30:46.000Z [INFO] Connected to DynamoDB
```

---

## Frontend Deployment

### Option 1: AWS Amplify (Recommended)

```bash
# 1. Ensure code is pushed to GitHub
git push origin main

# 2. Go to AWS Amplify Console
# 3. Click "Create new app" → "Host web app"
# 4. Select GitHub → Select your repository
# 5. Configure build settings:

# Build command:
cd apps/frontend && npm run build

# Base directory:
apps/frontend

# 6. Set environment variables:
NEXT_PUBLIC_API_URL=https://$ALB_DNS/api/v1
NEXT_PUBLIC_GITHUB_CLIENT_ID=your-oauth-app-id

# 7. Deploy (Amplify will auto-deploy on Git push)
```

### Option 2: CloudFront + S3

```bash
# Build static site
cd apps/frontend
npm run build

# Create S3 bucket
aws s3api create-bucket \
  --bucket devdeploy-frontend-$RANDOM \
  --region us-east-1

# Enable static website hosting
aws s3 website s3://devdeploy-frontend-$RANDOM/ \
  --index-document index.html \
  --error-document 404.html

# Upload files
aws s3 sync .next s3://devdeploy-frontend-$RANDOM/ --delete

# Create CloudFront distribution
# (Use AWS Console or Terraform module)

# Get distribution URL
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?DomainName]'
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
ALB_DNS="your-alb-dns-name.elb.amazonaws.com"

# Backend health
curl http://$ALB_DNS/health
# Expected: {"status":"healthy","service":"devdeploy-api"}

# API endpoint
curl http://$ALB_DNS/api/v1/health
# Expected: {"status":"healthy","service":"devdeploy-api"}
```

### 2. Authentication Test

```bash
# Register a user
curl -X POST http://$ALB_DNS/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "name": "Test User"
  }'

# Login
TOKEN=$(curl -s -X POST http://$ALB_DNS/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePassword123!"}' \
  | jq -r '.data.token')

# Verify JWT token
curl http://$ALB_DNS/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Database Connectivity

```bash
# Verify DynamoDB tables exist
aws dynamodb list-tables --region us-east-1 \
  --query 'TableNames[?contains(@, `devdeploy`)]'

# Verify secrets in Secrets Manager
aws secretsmanager list-secrets --region us-east-1 \
  --query 'SecretList[?contains(Name, `devdeploy`)].{Name:Name,Updated:LastChangedDate}'

# Verify data in DynamoDB
aws dynamodb scan --table-name devdeploy-users --region us-east-1 \
  --query 'Items[*].{userId:userId.S,email:email.S}' \
  --output table
```

### 4. ECS Service Status

```bash
aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1 \
  --query 'services[0].{
    Status: status,
    DesiredCount: desiredCount,
    RunningCount: runningCount,
    PendingCount: pendingCount,
    LastDeploymentDate: deployments[0].createdAt,
    Deployments: deployments[*].{status: status, running: runningCount}
  }' \
  --output json | jq
```

### 5. ALB Target Health

```bash
# Get target group ARN
TG_ARN=$(aws elbv2 describe-target-groups \
  --region us-east-1 \
  --query 'TargetGroups[?contains(TargetGroupName, `devdeploy-dev-api`)].TargetGroupArn' \
  --output text)

# Check target health
aws elbv2 describe-target-health \
  --target-group-arn $TG_ARN \
  --region us-east-1 \
  --query 'TargetHealthDescriptions[*].{Target: Target.Id, State: TargetHealth.State, Reason: TargetHealth.Reason}' \
  --output table

# Expected: all targets should be "healthy"
```

---

## Monitoring & Logging

### 1. CloudWatch Logs

```bash
# View backend API logs
aws logs tail /devdeploy/dev/api --region us-east-1 --follow

# View event logs
aws logs tail /devdeploy/dev/events --region us-east-1 --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /devdeploy/dev/api \
  --region us-east-1 \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000)
```

### 2. CloudWatch Metrics

```bash
# Get CPU utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ServiceName,Value=devdeploy-dev-api-service \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Get memory utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name MemoryUtilization \
  --dimensions Name=ServiceName,Value=devdeploy-dev-api-service \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

### 3. Create Dashboards

```bash
# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name DevDeployDashboard \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "metrics": [
            ["AWS/ECS", "CPUUtilization", {"stat": "Average"}],
            ["...", "MemoryUtilization", {"stat": "Average"}]
          ],
          "period": 300,
          "stat": "Average",
          "region": "us-east-1",
          "title": "ECS Service Metrics"
        }
      }
    ]
  }'
```

---

## Cost Optimization

### 1. Auto-Scaling Configuration

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/devdeploy-dev-cluster/devdeploy-dev-api-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 5 \
  --region us-east-1

# Create scaling policy (scale up at 70% CPU)
aws application-autoscaling put-scaling-policy \
  --policy-name cpu-scaling \
  --service-namespace ecs \
  --resource-id service/devdeploy-dev-cluster/devdeploy-dev-api-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration \
    TargetValue=70,PredefinedMetricSpecification={PredefinedMetricType=ECSServiceAverageCPUUtilization} \
  --region us-east-1
```

### 2. Cost Analysis

```bash
# Get AWS Cost Explorer data
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region us-east-1
```

### 3. Optimize Costs

- Use DynamoDB on-demand billing (no reserved capacity)
- Use ECR lifecycle policies to delete old images
- Set up CloudWatch log retention (30 days)
- Use spot instances if fault-tolerant
- Enable S3 lifecycle policies

---

## Scaling & Performance

### 1. Increase Capacity

```bash
# Scale up to more tasks
aws ecs update-service \
  --cluster devdeploy-dev-cluster \
  --service devdeploy-dev-api-service \
  --desired-count 5 \
  --region us-east-1
```

### 2. Increase Task Resources

```bash
# Update task CPU and memory
aws ecs register-task-definition \
  --family devdeploy-dev-api \
  --cpu 512 \
  --memory 1024 \
  --container-definitions file://task-definition.json \
  --region us-east-1
```

### 3. Database Performance

```bash
# Check DynamoDB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value=devdeploy-users \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

## Rollback Procedure

### If Deployment Fails

```bash
# 1. Get previous task definition
PREVIOUS_TASK=$(aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1 \
  --query 'services[0].deployments[-2].taskDefinition' \
  --output text)

# 2. Revert to previous task definition
aws ecs update-service \
  --cluster devdeploy-dev-cluster \
  --service devdeploy-dev-api-service \
  --task-definition $PREVIOUS_TASK \
  --force-new-deployment \
  --region us-east-1

# 3. Monitor rollback
aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1 \
  --query 'services[0].deployments[*].{status:status,taskDef:taskDefinition}'
```

---

## Troubleshooting

### ECS Tasks failing to start

```bash
# 1. Check task logs
aws logs tail /devdeploy/dev/api --region us-east-1

# 2. Describe task definition
aws ecs describe-task-definition \
  --task-definition devdeploy-dev-api:latest \
  --region us-east-1 | jq '.taskDefinition.containerDefinitions[0]'

# 3. Check for missing environment variables
# Verify all variables are in Secrets Manager:
aws secretsmanager get-secret-value \
  --secret-id devdeploy-dev-app-secrets \
  --region us-east-1 | jq '.SecretString | fromjson'

# 4. Check ECS agent logs
aws logs tail /ecs/devdeploy-dev-cluster --region us-east-1
```

### ALB not reaching backend

```bash
# 1. Check security group rules
aws ec2 describe-security-groups \
  --filters Name=group-name,Values=devdeploy-ecs-sg \
  --region us-east-1 \
  --query 'SecurityGroups[0].IpPermissions'

# 2. Check target health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/devdeploy-dev-api-tg/XXXXX \
  --region us-east-1 \
  --query 'TargetHealthDescriptions[*].{Target:Target.Id,State:TargetHealth.State,Reason:TargetHealth.Reason}'

# 3. Check health check configuration
aws elbv2 describe-target-groups \
  --region us-east-1 \
  --query 'TargetGroups[?TargetGroupName==`devdeploy-dev-api-tg`].{HealthCheckPath:HealthCheckPath,HealthCheckPort:HealthCheckPort,HealthCheckProtocol:HealthCheckProtocol,HealthyThresholdCount:HealthyThresholdCount}'
```

---

## Cleanup (Destroy Infrastructure)

**⚠️ WARNING: This is destructive and cannot be undone**

```bash
cd infrastructure/terraform/environments/dev

# View what will be destroyed
terraform plan -var-file=secrets.auto.tfvars -destroy

# Destroy all resources
terraform destroy -var-file=secrets.auto.tfvars -auto-approve

# Expected output:
# Destroy complete! Resources: 45 destroyed.

# Note: This does NOT delete:
# - DynamoDB backups
# - S3 buckets (to prevent data loss)
# - CloudWatch log groups (may be needed for debugging)
# Delete these manually from AWS Console if needed
```

---

## Useful AWS CLI Commands

```bash
# List all resources in environment
aws resourcegroupstaggingapi get-resources \
  --region us-east-1 \
  --tag-filter-list 'Key=Environment,Values=dev'

# Get all outputs
cd infrastructure/terraform/environments/dev
terraform output -json

# Monitor service health
watch -n 5 'aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1 \
  --query "services[0].{running:runningCount,desired:desiredCount}" \
  --output table'

# SSH into ECS task (requires Session Manager)
aws ecs execute-command \
  --cluster devdeploy-dev-cluster \
  --task devdeploy-dev-api-XXXXX \
  --container api \
  --interactive \
  --region us-east-1 \
  --command "/bin/sh"
```

---

## Next Steps

1. ✅ Infrastructure provisioned
2. ✅ Backend deployed to ECS
3. ✅ Frontend deployed to Amplify/S3
4. ✅ Monitoring configured
5. **→ Setup CI/CD with GitHub Actions** (see [.github/workflows](../../.github/workflows/))
6. → Configure custom domain (Route53)
7. → Setup SSL/TLS certificate (ACM)
8. → Configure backup/disaster recovery
9. → Setup security monitoring

---

**Last updated: July 4, 2026**
