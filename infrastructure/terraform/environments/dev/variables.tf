variable "project_name" {
  description = "Project name prefix for all resources"
  type        = string
  default     = "devdeploy"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones to deploy into"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "github_username" {
  description = "GitHub username"
  type        = string
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "internal_key" {
  type      = string
  sensitive = true
}

variable "token_encryption_key" {
  description = "AES-256 key for encrypting GitHub OAuth tokens stored in DynamoDB"
  type        = string
  sensitive   = true
}

variable "github_client_id" {
  description = "GitHub OAuth App client ID"
  type        = string
  sensitive   = true
}

variable "github_client_secret" {
  description = "GitHub OAuth App client secret"
  type        = string
  sensitive   = true
}

variable "devdeploy_github_token" {
  description = "Platform PAT for triggering GitHub Actions workflows"
  type        = string
  sensitive   = true
  default     = ""
}

variable "alert_email" {
  description = "Email address to receive CloudWatch alarm notifications"
  type        = string
}

variable "github_repo" {
  description = "Repo (and optional ref) allowed to assume the GitHub Actions role. \"*\" = any repo under github_username (previous behaviour). Tighten to e.g. \"dev_deploy:ref:refs/heads/main\"."
  type        = string
  default     = "*"
}
