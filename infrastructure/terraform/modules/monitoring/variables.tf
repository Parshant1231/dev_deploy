variable "project_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }

variable "alert_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
}

variable "ecs_cluster_name" {
  description = "ECS cluster name for alarm dimensions"
  type        = string
}

variable "api_service_name" {
  description = "ECS API service name for alarm dimensions"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix (format required by CloudWatch dimensions)"
  type        = string
}