variable "project_name" { type = string }
variable "environment" { type = string }
variable "aws_region" { type = string }
variable "aws_account_id" { type = string }

variable "github_username" {
  description = "GitHub username or organization — used to scope OIDC trust"
  type        = string
}

variable "github_repo" {
  description = <<-EOT
    Repository (and optional ref) allowed to assume the GitHub Actions role,
    appended to "repo:<github_username>/". Examples:
      "*"                              any repo, any branch  (previous behaviour)
      "dev_deploy"                     one repo, any branch
      "dev_deploy:ref:refs/heads/main" one repo, main branch only
  EOT
  type        = string
  default     = "*"
}

variable "app_secrets_arn" {
  description = "ARN of the Secrets Manager secret the ECS execution role may read"
  type        = string
}
