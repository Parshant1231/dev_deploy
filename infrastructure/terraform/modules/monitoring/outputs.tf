output "api_log_group_name" {
  value = aws_cloudwatch_log_group.api.name
}

output "deployment_log_group_name" {
  value = aws_cloudwatch_log_group.deployments.name
}

output "lambda_log_group_name" {
  value = aws_cloudwatch_log_group.lambda.name
}

output "dashboard_name" {
  value = aws_cloudwatch_dashboard.main.dashboard_name
}

output "sns_alerts_topic_arn" {
  description = "SNS topic ARN for deployment and infrastructure alerts"
  value       = aws_sns_topic.alerts.arn
}