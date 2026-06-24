output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs.id
}

output "ecs_task_role_arn" {
  value = aws_iam_role.ecs_task_role.arn
}

output "ecs_execution_role_arn" {
  value = aws_iam_role.ecs_execution_role.arn
}

output "lambda_role_arn" {
  value = aws_iam_role.lambda_role.arn
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC"
  value       = aws_iam_role.github_actions.arn
}

output "app_secrets_arn" {
  description = "ARN of the Secrets Manager secret holding app runtime secrets"
  value       = aws_secretsmanager_secret.app_secrets.arn
}