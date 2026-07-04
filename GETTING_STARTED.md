# Getting Started with DevDeploy

A complete step-by-step guide to clone, setup, secure, and deploy DevDeploy.

**⏱️ Estimated time: 30 minutes for local setup, 1-2 hours for AWS deployment**

---

## Table of Contents

1. [Part 1: Clone & Setup (15 minutes)](#part-1-clone--setup-15-minutes)
2. [Part 2: Local Development (10 minutes)](#part-2-local-development-10-minutes)
3. [Part 3: Security Setup (5 minutes)](#part-3-security-setup-5-minutes)
4. [Part 4: Deploy to AWS (1-2 hours)](#part-4-deploy-to-aws-1-2-hours)
5. [Part 5: Verify Everything Works (15 minutes)](#part-5-verify-everything-works-15-minutes)

---

## Part 1: Clone & Setup (15 minutes)

### 1.1 System Requirements

Verify you have the required tools installed:

```bash
# Check Node.js (need v18+)
node --version
npm --version

# Check Git
git --version

# For AWS deployment, also need:
aws --version          # AWS CLI
terraform --version   # Terraform
docker --version      # Docker
```

If any are missing, install them:

- **Node.js**: https://nodejs.org (download v18 or v20 LTS)
- **Git**: https://git-scm.com
- **AWS CLI**: `brew install awscli` (macOS) or `choco install awscli` (Windows)
- **Terraform**: `brew install terraform` (macOS) or `choco install terraform` (Windows)
- **Docker**: https://www.docker.com/products/docker-desktop

### 1.2 Clone the Repository

```bash
# Clone the repo
git clone https://github.com/Parshant1231/dev_deploy.git
cd dev_deploy

# Verify the structure
ls -la
# Should show: apps/, infrastructure/, .github/, README.md, etc.
```

### 1.3 Install Dependencies

```bash
# Install root dependencies
npm install

# Navigate to backend and install
cd apps/backend
npm install

# Navigate to frontend and install
cd ../frontend
npm install

# Return to root
cd ../..

# Verify installations
npm list --depth=0  # Shows installed packages
```

### 1.4 Verify Project Structure

```bash
# List the directory structure
tree -L 2 -I 'node_modules'

# Expected output:
# dev_deploy/
# ├── apps/
# │   ├── backend/
# │   └── frontend/
# ├── infrastructure/
# │   ├── terraform/
# │   └── docker/
# ├── .github/
# │   └── workflows/
# ├── README.md
# ├── .env.example
# └── .gitignore
```

---

## Part 2: Local Development (10 minutes)

### 2.1 Setup Environment Files

#### Backend Environment

```bash
# Navigate to backend
cd apps/backend

# Copy the example file
cp ../../.env.example .env

# Edit the file with your values
# Use your favorite editor (nano, vim, VS Code, etc.)
nano .env
```

**Minimal .env for local development:**

```bash
NODE_ENV=development
PORT=3001
API_BASE_URL=http://localhost:3001

# Generate these with: openssl rand -hex 32
JWT_SECRET=your-strong-random-32-character-value-here-minimum-1234567890
TOKEN_ENCRYPTION_KEY=your-strong-random-32-byte-hex-key-here-1234567890
DEVDEPLOY_INTERNAL_KEY=your-internal-api-key-random-value-here-1234567890

# GitHub OAuth (get from GitHub Settings)
GITHUB_CLIENT_ID=your-github-oauth-id
GITHUB_CLIENT_SECRET=your-github-oauth-secret

# AWS (optional for local dev, needed for AWS deployment)
AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your-aws-key
# AWS_SECRET_ACCESS_KEY=your-aws-secret

# DynamoDB table prefix
DYNAMODB_TABLE_PREFIX=devdeploy

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

LOG_LEVEL=debug
```

#### Frontend Environment

```bash
# Navigate to frontend
cd apps/frontend

# Copy the example file
cp ../../.env.example .env.local

# Edit the file
nano .env.local
```

**Minimal .env.local for local development:**

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_GITHUB_CLIENT_ID=your-github-oauth-id
NEXT_PUBLIC_APP_NAME=DevDeploy
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENVIRONMENT=development
```

### 2.2 Generate Strong Secrets

**Generate strong values for security:**

```bash
# Generate JWT_SECRET
echo "JWT_SECRET: $(openssl rand -hex 32)"

# Generate TOKEN_ENCRYPTION_KEY
echo "TOKEN_ENCRYPTION_KEY: $(openssl rand -hex 32)"

# Generate DEVDEPLOY_INTERNAL_KEY
echo "DEVDEPLOY_INTERNAL_KEY: $(openssl rand -hex 32)"

# Copy these values into your .env files
```

### 2.3 Setup GitHub OAuth

**Get GitHub OAuth credentials:**

1. Go to GitHub Settings → Developer Settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in the form:
   - **Application name**: DevDeploy
   - **Homepage URL**: http://localhost:3000
   - **Authorization callback URL**: http://localhost:3001/api/v1/auth/github/callback
4. Click "Create OAuth application"
5. Copy the **Client ID** and **Client Secret**
6. Add them to your `.env` files:

```bash
# Backend: apps/backend/.env
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret

# Frontend: apps/frontend/.env.local
NEXT_PUBLIC_GITHUB_CLIENT_ID=your-client-id
```

### 2.4 Start Development Servers

**Terminal 1 - Start Backend:**

```bash
cd apps/backend
npm run dev

# Expected output:
# [PORT] 3001 ready
# ts-node-dev version 2.0.0
# [ts-node-dev] successful to recompile
```

**Terminal 2 - Start Frontend:**

```bash
cd apps/frontend
npm run dev

# Expected output:
# > dev
# ▲ Next.js 14.x.x
# ✓ Ready in 2.5s
# ✓ Compiled client and server successfully
```

### 2.5 Access the Application

Open your browser:

- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:3001/health
- **API Docs**: http://localhost:3001/api/docs (if enabled)

**Test health check:**

```bash
curl http://localhost:3001/health
# Expected: {"status":"healthy","service":"devdeploy-api"}
```

---

## Part 3: Security Setup (5 minutes)

### 3.1 .gitignore Configuration

**Verify .gitignore has sensitive files:**

```bash
# Check .gitignore
cat .gitignore | grep -E "\.env|secrets|credentials"

# Should contain:
# .env
# .env.local
# .env.*.local
# **/secrets.auto.tfvars
# .aws/credentials
```

If missing, add these lines:

```bash
# Append to .gitignore
cat >> .gitignore << 'EOF'
# Environment variables
.env
.env.local
.env.*.local

# Secrets
**/secrets.auto.tfvars
*.key
*.pem

# AWS credentials
.aws/credentials
.aws/config

# IDE
.vscode/settings.json
.idea/

# Build output
dist/
build/
node_modules/
EOF
```

### 3.2 Verify No Secrets in Git

```bash
# Check if any .env files are tracked (they shouldn't be)
git ls-files | grep -E "\.env|secrets\.auto\.tfvars"

# Should return nothing. If it returns files, remove them:
git rm --cached .env
git commit -m "chore: remove .env from version control"
```

### 3.3 Create a Secrets Storage Template

**Create infrastructure/terraform/environments/dev/secrets.auto.tfvars:**

```hcl
# ⚠️ NEVER COMMIT THIS FILE
# Add to .gitignore: **/secrets.auto.tfvars

jwt_secret_value           = "generate-with-openssl-rand-hex-64"
token_encryption_key_value = "generate-with-openssl-rand-hex-32"
devdeploy_github_token     = "ghp_your-github-personal-access-token"
github_client_id           = "your-oauth-app-id"
github_client_secret       = "your-oauth-app-secret"
```

### 3.4 Security Best Practices Checklist

- ✅ All `.env` files in `.gitignore`
- ✅ Secrets are minimum 32 characters
- ✅ Different secrets for dev/staging/production
- ✅ GitHub OAuth credentials from official GitHub Settings
- ✅ AWS credentials stored in `~/.aws/credentials` (not in code)
- ✅ No secrets in commit messages or pull requests
- ✅ MFA enabled on GitHub and AWS accounts

---

## Part 4: Deploy to AWS (1-2 hours)

### 4.1 Prerequisites for AWS

```bash
# Verify AWS CLI is configured
aws sts get-caller-identity
# Should show your AWS account details

# Verify Terraform is installed
terraform --version

# Verify Docker is running
docker ps

# Verify AWS credentials have permissions
aws ec2 describe-regions --query 'Regions[0]'
```

### 4.2 Create AWS Secrets

**Generate production-grade secrets:**

```bash
# Generate strong secrets (don't reuse dev values!)
JWT_SECRET=$(openssl rand -hex 64)
TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
INTERNAL_KEY=$(openssl rand -hex 32)

# Display for copying
echo "JWT_SECRET=$JWT_SECRET"
echo "TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY"
echo "INTERNAL_KEY=$INTERNAL_KEY"
```

**Create GitHub Personal Access Token:**

1. Go to GitHub Settings → Developer Settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it scopes: `repo`, `workflow`, `admin:repo_hook`
4. Copy the token (you won't see it again)
5. Add to your secrets file

### 4.3 Prepare Terraform Secrets File

```bash
# Navigate to environment directory
cd infrastructure/terraform/environments/dev

# Create secrets file
cat > secrets.auto.tfvars << 'EOF'
jwt_secret_value           = "your-generated-jwt-secret-hex-64"
token_encryption_key_value = "your-generated-token-key-hex-32"
devdeploy_github_token     = "ghp_your-personal-access-token"
github_client_id           = "your-oauth-app-id"
github_client_secret       = "your-oauth-app-secret"
EOF

# Verify it was created (but don't view the content with cat - it's sensitive!)
ls -la secrets.auto.tfvars

# Verify it's in .gitignore
echo "**/secrets.auto.tfvars" >> ../../.gitignore
```

### 4.4 Build and Push Docker Image to ECR

```bash
# Navigate to backend
cd apps/backend

# Build Docker image
docker build -t devdeploy-api:latest .

# Get ECR repo URL from AWS (or you can set it manually)
ECR_REPO_URL="123456789.dkr.ecr.us-east-1.amazonaws.com/devdeploy-api"

# Tag the image
docker tag devdeploy-api:latest $ECR_REPO_URL:latest

# Login to ECR (get the login command from AWS Console or CLI)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_REPO_URL

# Push to ECR
docker push $ECR_REPO_URL:latest

# Verify
aws ecr describe-images --repository-name devdeploy-api --region us-east-1
```

### 4.5 Deploy Infrastructure with Terraform

```bash
# Navigate to Terraform environment
cd infrastructure/terraform/environments/dev

# Initialize Terraform (download AWS provider, etc.)
terraform init

# Validate the configuration
terraform validate

# Show what will be created (review before applying!)
terraform plan -var-file=secrets.auto.tfvars

# Apply the changes (this provisions all AWS resources)
terraform apply -var-file=secrets.auto.tfvars -auto-approve

# This creates:
# - VPC and networking
# - ECS cluster and services
# - DynamoDB tables
# - RDS database (if configured)
# - Application Load Balancer (ALB)
# - CloudWatch log groups
# - IAM roles and policies
# - Secrets Manager entries
```

**⏱️ This takes 10-15 minutes. Go grab coffee!**

### 4.6 Get the ALB DNS Name

```bash
# After Terraform completes, get the load balancer DNS
aws elbv2 describe-load-balancers \
  --region us-east-1 \
  --query 'LoadBalancers[?contains(LoadBalancerName,`devdeploy`)].DNSName' \
  --output text

# Save this for testing:
ALB_DNS="your-alb-dns-name.elb.amazonaws.com"
```

### 4.7 Deploy Frontend to AWS

**Option A: AWS Amplify (Recommended)**

```bash
# 1. Push your code to GitHub (if not already)
git add .
git commit -m "feat: prepare for production deployment"
git push origin main

# 2. Go to AWS Amplify Console
# 3. Click "Create new app" → "Host web app"
# 4. Connect your GitHub repository
# 5. Set build settings:
FRONTEND_BUILD_COMMAND: cd apps/frontend && npm run build
FRONTEND_BUILD_OUTPUT: apps/frontend/.next

# 6. Add environment variables:
NEXT_PUBLIC_API_URL=https://$ALB_DNS/api/v1
NEXT_PUBLIC_GITHUB_CLIENT_ID=your-oauth-client-id

# 7. Deploy!
```

**Option B: AWS S3 + CloudFront**

```bash
# Build static site
cd apps/frontend
npm run build

# Upload to S3
aws s3 sync out/ s3://your-bucket-name --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

---

## Part 5: Verify Everything Works (15 minutes)

### 5.1 Test Health Endpoints

```bash
ALB_DNS="your-alb-dns-from-step-4.6"

# Test backend API health
curl http://$ALB_DNS/health

# Expected: 200 OK with JSON response
# {"status":"healthy","service":"devdeploy-api"}

# Test frontend is accessible
curl -I http://$ALB_DNS/

# Expected: 200 OK (or 307 redirect)
```

### 5.2 Test Authentication Flow

```bash
ALB_DNS="your-alb-dns"

# 1. Register a new user
curl -X POST http://$ALB_DNS/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePassword123!",
    "name": "Test User"
  }'

# Expected response with user object and JWT token

# 2. Login
TOKEN=$(curl -s -X POST http://$ALB_DNS/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"SecurePassword123!"}' \
  | jq -r '.data.token')

echo "Token: $TOKEN"

# 3. Get current user (requires token)
curl http://$ALB_DNS/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: user details returned
```

### 5.3 Test Project Creation

```bash
ALB_DNS="your-alb-dns"

# Create a project
curl -X POST http://$ALB_DNS/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First App",
    "framework": "nodejs",
    "port": 3000
  }'

# Expected: project object with projectId

# List projects
curl http://$ALB_DNS/api/v1/projects \
  -H "Authorization: Bearer $TOKEN"
```

### 5.4 Check AWS Resources

```bash
# Verify ECS service is running
aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1 \
  --query 'services[0].{status:status,running:runningCount,desired:desiredCount}'

# Verify DynamoDB tables exist
aws dynamodb list-tables --region us-east-1 \
  --query 'TableNames[?contains(@, `devdeploy`)]'

# Verify Secrets Manager secrets
aws secretsmanager list-secrets --region us-east-1 \
  --query 'SecretList[?contains(Name, `devdeploy`)].Name'

# View backend logs
aws logs tail /devdeploy/dev/api --region us-east-1 --follow
```

### 5.5 Create an End-to-End Test

```bash
ALB_DNS="your-alb-dns"

echo "=== TESTING COMPLETE DEVDEPLOY WORKFLOW ==="

# Step 1: Login
echo "📝 Step 1: Logging in..."
LOGIN=$(curl -s -X POST http://$ALB_DNS/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"SecurePassword123!"}')

TOKEN=$(echo $LOGIN | jq -r '.data.token')
USER_ID=$(echo $LOGIN | jq -r '.data.user.userId')
echo "✅ Logged in as: $USER_ID"

# Step 2: Create project
echo "📦 Step 2: Creating project..."
PROJECT=$(curl -s -X POST http://$ALB_DNS/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E Test App","framework":"nodejs","port":3000}')

PROJECT_ID=$(echo $PROJECT | jq -r '.data.projectId')
echo "✅ Project created: $PROJECT_ID"

# Step 3: List projects
echo "📋 Step 3: Listing projects..."
PROJECTS=$(curl -s http://$ALB_DNS/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data | length')
echo "✅ Found $PROJECTS projects"

echo "🎉 All tests passed!"
```

---

## Troubleshooting

### Local Development Issues

**Backend won't start:**

```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill the process if needed
kill -9 <PID>

# Check Node.js version
node --version  # Should be v18+

# Check environment variables
echo $JWT_SECRET  # Should output your secret

# Check logs
cd apps/backend
npm run dev  # Run in foreground to see errors
```

**Frontend won't start:**

```bash
# Check if port 3000 is in use
lsof -i :3000

# Clear Next.js cache
cd apps/frontend
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Start again
npm run dev
```

**Can't connect to backend:**

```bash
# Verify backend is running
curl http://localhost:3001/health

# Check NEXT_PUBLIC_API_URL
cat apps/frontend/.env.local | grep API_URL

# Check browser console for CORS errors
# Make sure backend has CORS enabled for http://localhost:3000
```

### AWS Deployment Issues

**Terraform apply fails:**

```bash
# Check syntax errors
terraform validate

# Check if AWS credentials are configured
aws sts get-caller-identity

# Check Terraform state
terraform show | head -20

# If stuck, check logs
terraform apply -var-file=secrets.auto.tfvars 2>&1 | tail -50
```

**ECS service not healthy:**

```bash
# Check service status
aws ecs describe-services \
  --cluster devdeploy-dev-cluster \
  --services devdeploy-dev-api-service \
  --region us-east-1

# Check task logs
aws logs tail /devdeploy/dev/api --region us-east-1

# Check task definition
aws ecs describe-task-definition \
  --task-definition devdeploy-dev-api:latest \
  --region us-east-1 | jq '.taskDefinition.containerDefinitions[0].secrets'
```

**Can't reach ALB:**

```bash
# Get ALB DNS
aws elbv2 describe-load-balancers --region us-east-1 \
  --query 'LoadBalancers[?contains(LoadBalancerName,`devdeploy`)].{Name:LoadBalancerName,DNS:DNSName}'

# Check target group health
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/devdeploy-dev-api-tg/XXXX \
  --region us-east-1
```

---

## Next Steps

After successful setup:

1. **Connect your GitHub account** in the dashboard
2. **Create your first project** and link a GitHub repository
3. **Configure deployment settings** (environment, branch, etc.)
4. **Deploy your application** via the dashboard
5. **Monitor deployment logs** in CloudWatch
6. **Share the deployed app** URL with your team

---

## Need Help?

- 📖 **Documentation**: See [README.md](./README.md)
- 🧪 **API Testing**: See [API_TESTING.md](./API_TESTING.md)
- 🏗️ **Architecture**: See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- 🐛 **Issues**: Check GitHub issues or create a new one
- 💬 **Questions**: Reach out to the development team

---

**Last updated: July 4, 2026**
