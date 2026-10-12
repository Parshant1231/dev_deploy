# ─────────────────────────────────────────────
# MONITORING MODULE
# Creates: CloudWatch log groups, SNS alert topic,
#          ECS CPU/memory alarms, ALB 5xx alarm,
#          and a CloudWatch dashboard.
# ─────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ── LOG GROUPS ────────────────────────────────
resource "aws_cloudwatch_log_group" "api" {
  name              = "/devdeploy/${var.environment}/api"
  retention_in_days = 30
  tags              = { Name = "${local.name_prefix}-api-logs" }
}

resource "aws_cloudwatch_log_group" "deployments" {
  name              = "/devdeploy/${var.environment}/deployments"
  retention_in_days = 30
  tags              = { Name = "${local.name_prefix}-deployment-logs" }
}

# ── SNS ALERT TOPIC ───────────────────────────
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"
  tags = { Name = "${local.name_prefix}-alerts" }
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ── ECS CPU ALARM ─────────────────────────────
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${local.name_prefix}-ecs-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "ECS CPU > 80% for 10 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.api_service_name
  }
}

# ── ECS MEMORY ALARM ──────────────────────────
resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "${local.name_prefix}-ecs-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "ECS memory > 85% for 10 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.api_service_name
  }
}

# ── ALB 5XX ALARM ─────────────────────────────
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name_prefix}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "More than 10 5xx errors per minute"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }
}

# ── CLOUDWATCH DASHBOARD ─────────────────────
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          title  = "ECS CPU & Memory"
          region = var.aws_region
          period = 300
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.api_service_name, { stat = "Average", label = "CPU %" }],
            [".", "MemoryUtilization", ".", ".", ".", ".", { stat = "Average", label = "Memory %" }]
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },
      {
        type = "metric"
        properties = {
          title  = "ALB Request Count & 5xx Errors"
          region = var.aws_region
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix, { stat = "Sum", label = "Requests" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", { stat = "Sum", label = "5xx Errors" }]
          ]
        }
      },
      {
        type = "log"
        properties = {
          title   = "API Recent Errors"
          region  = var.aws_region
          query   = "SOURCE '/devdeploy/${var.environment}/api' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 20"
          view    = "table"
        }
      }
    ]
  })
}
