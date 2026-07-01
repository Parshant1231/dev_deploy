output "auto_destroy_function_name" {
  value = aws_lambda_function.auto_destroy.function_name
}

output "auto_destroy_function_arn" {
  value = aws_lambda_function.auto_destroy.arn
}

output "scheduler_name" {
  value = aws_scheduler_schedule.auto_destroy.name
}