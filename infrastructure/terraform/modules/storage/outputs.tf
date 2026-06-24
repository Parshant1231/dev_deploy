output "ecr_api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecr_user_apps_repository_url" {
  value = aws_ecr_repository.user_apps.repository_url
}

output "s3_artifacts_bucket_name" {
  value = aws_s3_bucket.artifacts.bucket
}

output "dynamodb_table_names" {
  value = {
    users        = aws_dynamodb_table.users.name
    projects     = aws_dynamodb_table.projects.name
    deployments  = aws_dynamodb_table.deployments.name
    environments = aws_dynamodb_table.environments.name
    events       = aws_dynamodb_table.events.name
  }
}