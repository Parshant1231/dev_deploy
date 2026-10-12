output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "alb_arn" {
  value = aws_lb.main.arn
}

output "alb_arn_suffix" {
  description = "ALB ARN suffix in the format CloudWatch dimensions require"
  value       = aws_lb.main.arn_suffix
}

output "alb_listener_arn" {
  description = "ALB HTTP listener ARN — used by the pipeline to create listener rules"
  value       = aws_lb_listener.http.arn
}

output "target_group_arn" {
  value = aws_lb_target_group.api.arn
}
