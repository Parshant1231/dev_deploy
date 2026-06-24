variable "project_name" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "devdeploy"
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID — used to create globally unique S3 bucket name"
  type        = string
}