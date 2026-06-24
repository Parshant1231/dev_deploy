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