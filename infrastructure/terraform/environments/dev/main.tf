# DevDeploy — Dev Environment
# This file wires together all infrastructure modules.
# Every resource in this environment is tagged with environment = "dev".

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — uses the S3 bucket created in bootstrap
  backend "s3" {
    bucket         = "devdeploy-terraform-state-977069958259"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "devdeploy-terraform-locks"
    encrypt        = true
  }
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
# MODULE: NETWORKING
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
# MODULE: SECURITY
# ─────────────────────────────────────────────

module "security" {
  source = "../../modules/security"

  project_name    = var.project_name
  environment     = var.environment
  vpc_id          = module.networking.vpc_id
  aws_region      = var.aws_region
  aws_account_id  = var.aws_account_id
  github_username = var.github_username
  jwt_secret      = var.jwt_secret
  internal_key    = var.internal_key
}

# ─────────────────────────────────────────────
# MODULE: STORAGE
# ─────────────────────────────────────────────

module "storage" {
  source = "../../modules/storage"

  project_name   = var.project_name
  environment    = var.environment
  aws_region     = var.aws_region
  aws_account_id = var.aws_account_id

}

# ─────────────────────────────────────────────
# MODULE: COMPUTE
# ─────────────────────────────────────────────

module "compute" {
  source = "../../modules/compute"

  project_name            = var.project_name
  environment             = var.environment
  aws_region              = var.aws_region
  vpc_id                  = module.networking.vpc_id
  public_subnet_ids       = module.networking.public_subnet_ids
  private_subnet_ids      = module.networking.private_subnet_ids
  alb_security_group_id   = module.security.alb_security_group_id
  ecs_security_group_id   = module.security.ecs_security_group_id
  ecs_task_role_arn       = module.security.ecs_task_role_arn
  ecs_execution_role_arn  = module.security.ecs_execution_role_arn
  ecr_repository_url      = module.storage.ecr_api_repository_url
  log_group_name          = module.monitoring.api_log_group_name
  app_secrets_arn         = module.security.app_secrets_arn
  users_table_name        = module.storage.users_table_name
  projects_table_name     = module.storage.projects_table_name
  deployments_table_name  = module.storage.deployments_table_name
  environments_table_name = module.storage.environments_table_name
  events_table_name       = module.storage.events_table_name

}

# ─────────────────────────────────────────────
# MODULE: MONITORING
# ─────────────────────────────────────────────

module "monitoring" {
  source = "../../modules/monitoring"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region
}