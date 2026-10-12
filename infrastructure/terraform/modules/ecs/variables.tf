variable "project_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "alb_security_group_id" { type = string }
variable "target_group_arn" { type = string }
variable "ecs_task_role_arn" { type = string }
variable "ecs_execution_role_arn" { type = string }
variable "ecr_repository_url" { type = string }
variable "log_group_name" { type = string }

variable "app_secrets_arn" {
  description = "ARN of the Secrets Manager secret containing runtime secrets"
  type        = string
}

variable "container_port" {
  type    = number
  default = 3001
}

variable "users_table_name" { type = string }
variable "projects_table_name" { type = string }
variable "deployments_table_name" { type = string }
variable "environments_table_name" { type = string }
variable "events_table_name" { type = string }

variable "api_public_url" {
  description = "Publicly reachable URL of the API (passed to GitHub Actions as api_url)"
  type        = string
}

variable "devdeploy_repo_owner" {
  description = "GitHub username that owns the devdeploy repo (workflow triggers)"
  type        = string
}

variable "devdeploy_repo_name" {
  description = "Name of the devdeploy repository"
  type        = string
  default     = "dev_deploy"
}

variable "ecs_cluster_name_for_env" {
  description = "ECS cluster name injected into container env (avoids circular ref)"
  type        = string
  default     = ""
}

variable "auto_destroy_function_name" {
  description = "Lambda auto-destroy function name"
  type        = string
  default     = ""
}

variable "event_bus_name" {
  description = "EventBridge custom bus name"
  type        = string
  default     = "devdeploy-dev-events"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
  default     = ""
}
