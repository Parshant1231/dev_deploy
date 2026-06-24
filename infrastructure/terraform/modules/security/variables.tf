variable "project_name" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "aws_region" { type = string }
variable "aws_account_id" { type = string }
variable "github_username" {
  description = "GitHub username or organization — used to scope OIDC trust"
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