output "app_secrets_arn" {
  description = "ARN of the Secrets Manager secret holding app runtime secrets"
  value       = aws_secretsmanager_secret.app_secrets.arn
}
