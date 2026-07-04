output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "alb_arn" {
  value = aws_lb.main.arn
}

output "api_service_name" {
  value = aws_ecs_service.api.name
}

output "alb_listener_arn" {
  description = "ALB HTTP listener ARN — used by pipeline to create listener rules"
  value       = aws_lb_listener.http.arn
}

output "alb_arn_suffix" {
  description = "ALB ARN suffix in the format CloudWatch dimensions require"
  value       = aws_lb.main.arn_suffix
}