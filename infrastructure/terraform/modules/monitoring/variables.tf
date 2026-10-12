variable "project_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }

variable "alert_email" {
  description = "Email to receive CloudWatch alarm notifications"
  type        = string
}

variable "ecs_cluster_name" { type = string }
variable "api_service_name" { type = string }
variable "alb_arn_suffix" { type = string }
