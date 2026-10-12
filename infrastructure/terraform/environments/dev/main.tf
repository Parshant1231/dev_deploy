# DevDeploy — Dev Environment
# Wires together all infrastructure modules.
# Every resource in this environment is tagged with environment = "dev".

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in the S3 bucket created by terraform/bootstrap, with DynamoDB locking.
  # Values live in backend.hcl (git-ignored) so no account ID is committed:
  #   terraform init -backend-config=backend.hcl
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "devdeploy"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# ─────────────────────────────────────────────
# MODULE: NETWORKING (VPC, public/private subnets, IGW, NAT)
# ─────────────────────────────────────────────

module "networking" {
  source = "../../modules/networking"

  project_name         = var.project_name
  environment          = var.environment
  aws_region           = var.aws_region
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# ─────────────────────────────────────────────
# MODULE: APP-SECRETS (Secrets Manager)
# ─────────────────────────────────────────────

module "app_secrets" {
  source = "../../modules/app-secrets"

  project_name           = var.project_name
  environment            = var.environment
  jwt_secret             = var.jwt_secret
  internal_key           = var.internal_key
  token_encryption_key   = var.token_encryption_key
  github_client_id       = var.github_client_id
  github_client_secret   = var.github_client_secret
  devdeploy_github_token = var.devdeploy_github_token
}

# ─────────────────────────────────────────────
# MODULE: IAM (ECS, Lambda and GitHub Actions roles)
# ─────────────────────────────────────────────

module "iam" {
  source = "../../modules/iam"

  project_name    = var.project_name
  environment     = var.environment
  aws_region      = var.aws_region
  aws_account_id  = var.aws_account_id
  github_username = var.github_username
  github_repo     = var.github_repo
  app_secrets_arn = module.app_secrets.app_secrets_arn
}

# ─────────────────────────────────────────────
# MODULE: STORAGE (DynamoDB, S3, ECR, EventBridge)
# ─────────────────────────────────────────────

module "storage" {
  source = "../../modules/storage"

  project_name   = var.project_name
  environment    = var.environment
  aws_region     = var.aws_region
  aws_account_id = var.aws_account_id
}

# ─────────────────────────────────────────────
# MODULE: ALB (load balancer, target group, listener)
# ─────────────────────────────────────────────

module "alb" {
  source = "../../modules/alb"

  project_name      = var.project_name
  environment       = var.environment
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
}

# ─────────────────────────────────────────────
# MODULE: ECS (cluster, task definition, Fargate service)
# ─────────────────────────────────────────────

module "ecs" {
  source = "../../modules/ecs"

  project_name           = var.project_name
  environment            = var.environment
  aws_region             = var.aws_region
  aws_account_id         = var.aws_account_id
  vpc_id                 = module.networking.vpc_id
  private_subnet_ids     = module.networking.private_subnet_ids
  alb_security_group_id  = module.alb.alb_security_group_id
  target_group_arn       = module.alb.target_group_arn
  ecs_task_role_arn      = module.iam.ecs_task_role_arn
  ecs_execution_role_arn = module.iam.ecs_execution_role_arn
  ecr_repository_url     = module.storage.ecr_api_repository_url
  log_group_name         = module.monitoring.api_log_group_name
  app_secrets_arn        = module.app_secrets.app_secrets_arn

  users_table_name        = module.storage.users_table_name
  projects_table_name     = module.storage.projects_table_name
  deployments_table_name  = module.storage.deployments_table_name
  environments_table_name = module.storage.environments_table_name
  events_table_name       = module.storage.events_table_name

  # Plain config values the app requires (not secrets)
  devdeploy_repo_owner       = var.github_username
  devdeploy_repo_name        = var.github_repo
  api_public_url             = "http://${module.alb.alb_dns_name}"
  event_bus_name             = module.storage.event_bus_name
  ecs_cluster_name_for_env   = "${var.project_name}-${var.environment}-cluster"
  auto_destroy_function_name = module.lambda.auto_destroy_function_name

  # The service must not be created before the ALB listener exists
  depends_on = [module.alb]
}

# ─────────────────────────────────────────────
# MODULE: MONITORING (CloudWatch logs, alarms, dashboard)
# ─────────────────────────────────────────────

module "monitoring" {
  source = "../../modules/monitoring"

  project_name     = var.project_name
  environment      = var.environment
  aws_region       = var.aws_region
  alert_email      = var.alert_email
  ecs_cluster_name = module.ecs.ecs_cluster_name
  api_service_name = module.ecs.api_service_name
  alb_arn_suffix   = module.alb.alb_arn_suffix
}

# ─────────────────────────────────────────────
# MODULE: LAMBDA (auto-destroy)
# ─────────────────────────────────────────────

module "lambda" {
  source = "../../modules/lambda"

  project_name   = var.project_name
  environment    = var.environment
  aws_region     = var.aws_region
  aws_account_id = var.aws_account_id

  lambda_role_arn  = module.iam.lambda_role_arn
  ecs_cluster_name = module.ecs.ecs_cluster_name
  event_bus_name   = module.storage.event_bus_name

  environments_table_name = module.storage.dynamodb_table_names["environments"]
  deployments_table_name  = module.storage.dynamodb_table_names["deployments"]
  events_table_name       = module.storage.dynamodb_table_names["events"]
}
