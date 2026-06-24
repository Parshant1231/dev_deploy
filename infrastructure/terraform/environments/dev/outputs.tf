output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.networking.private_subnet_ids
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.compute.ecs_cluster_name
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.compute.alb_dns_name
}

output "ecr_api_repository_url" {
  description = "ECR repository URL for the backend API"
  value       = module.storage.ecr_api_repository_url
}

output "dynamodb_table_names" {
  description = "All DynamoDB table names"
  value       = module.storage.dynamodb_table_names
}