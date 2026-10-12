output "api_log_group_name" {
  value = aws_cloudwatch_log_group.api.name
}

output "deployments_log_group_name" {
  value = aws_cloudwatch_log_group.deployments.name
}

output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}
