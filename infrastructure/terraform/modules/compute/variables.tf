variable "project_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "alb_security_group_id" { type = string }
variable "ecs_security_group_id" { type = string }
variable "ecs_task_role_arn" { type = string }
variable "ecs_execution_role_arn" { type = string }
variable "ecr_repository_url" { type = string }
variable "log_group_name" { type = string }
variable "app_secrets_arn" {
  description = "ARN of the Secrets Manager secret containing runtime secrets (JWT_SECRET, DEVDEPLOY_INTERNAL_KEY)"
  type        = string
}
variable "users_table_name" {
  type = string
}

variable "projects_table_name" {
  type = string
}

variable "deployments_table_name" {
  type = string
}

variable "environments_table_name" {
  type = string
}

variable "events_table_name" {
  type = string
}
