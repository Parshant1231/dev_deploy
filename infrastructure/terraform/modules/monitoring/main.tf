# ─────────────────────────────────────────────
# MONITORING MODULE
# Creates: CloudWatch Log Groups, Dashboard, Alarms
# ─────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ─────────────────────────────────────────────
# LOG GROUPS
# Log retention set to 30 days to control costs.
# In production, increase to 90 days.
# ─────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "api" {
  name              = "/devdeploy/${var.environment}/api"
  retention_in_days = 30

  tags = {
    Name = "${local.name_prefix}-api-logs"
  }
}

resource "aws_cloudwatch_log_group" "deployments" {
  name              = "/devdeploy/${var.environment}/deployments"
  retention_in_days = 30

  tags = {
    Name = "${local.name_prefix}-deployment-logs"
  }
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/devdeploy/${var.environment}/lambda"
  retention_in_days = 30

  tags = {
    Name = "${local.name_prefix}-lambda-logs"
  }
}

# The user app pipeline writes logs to /devdeploy/dev/user-apps. This log group must exist before any deployment runs.
resource "aws_cloudwatch_log_group" "user_apps" {
  name              = "/devdeploy/${var.environment}/user-apps"
  retention_in_days = 30

  tags = {
    Name = "${local.name_prefix}-user-apps-logs"
  }
}

# ─────────────────────────────────────────────
# CLOUDWATCH DASHBOARD
# ─────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          title  = "ECS CPU Utilization"
          region = var.aws_region
          period = 300
          metrics = [
            ["AWS/ECS", "CPUUtilization",
            "ClusterName", "${local.name_prefix}-cluster"]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          title  = "ECS Memory Utilization"
          region = var.aws_region
          period = 300
          metrics = [
            ["AWS/ECS", "MemoryUtilization",
            "ClusterName", "${local.name_prefix}-cluster"]
          ]
          view = "timeSeries"
        }
      },
      {
        type   = "log"
        width  = 24
        height = 6
        properties = {
          title  = "API Logs"
          query  = "SOURCE '/devdeploy/${var.environment}/api' | fields @timestamp, @message | sort @timestamp desc | limit 50"
          region = var.aws_region
          view   = "table"
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────
# SNS TOPIC — Alert Delivery
#
# CloudWatch Alarms publish to this topic when triggered.
# Email subscriptions receive a confirmation email first —
# AWS requires explicit opt-in before delivering notifications.
# ─────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"

  tags = {
    Name = "${local.name_prefix}-alerts"
  }
}

resource "aws_sns_topic_subscription" "email_alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ─────────────────────────────────────────────
# CLOUDWATCH ALARM — ECS Service CPU High
#
# Fires if average CPU utilization across the
# backend API service exceeds 80% for 2 consecutive
# 5-minute periods. Indicates the service may need
# more capacity or is under unexpected load.
# ─────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "api_cpu_high" {
  alarm_name          = "${local.name_prefix}-api-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Backend API CPU utilization exceeded 80% for 10 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.api_service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${local.name_prefix}-api-cpu-high"
  }
}

# ─────────────────────────────────────────────
# CLOUDWATCH ALARM — ECS Service Memory High
# ─────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "api_memory_high" {
  alarm_name          = "${local.name_prefix}-api-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Backend API memory utilization exceeded 85% for 10 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.api_service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${local.name_prefix}-api-memory-high"
  }
}

# ─────────────────────────────────────────────
# CLOUDWATCH ALARM — ALB 5xx Error Rate
#
# Fires if the ALB returns more than 10 server errors
# in a 5-minute window. This catches application-level
# failures (crashes, unhandled exceptions) that ECS
# health checks might not detect immediately.
# ─────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "${local.name_prefix}-alb-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "ALB returned more than 10 5xx errors in 5 minutes"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${local.name_prefix}-alb-5xx-errors"
  }
}

# ─────────────────────────────────────────────
# CLOUDWATCH ALARM — ECS Service Running Task Count Low
#
# Fires if the backend API has zero running tasks.
# This is the most critical alarm — it means the
# entire platform API is down.
# ─────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "api_no_running_tasks" {
  alarm_name          = "${local.name_prefix}-api-no-running-tasks"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = 60
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "CRITICAL: Backend API has zero running tasks"
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.api_service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${local.name_prefix}-api-no-running-tasks"
  }
}

# ─────────────────────────────────────────────
# CLOUDWATCH ALARM — High Deployment Failure Rate
#
# Custom metric published by the backend itself
# (Task 4 below) tracking failed deployments.
# Fires if more than 3 deployments fail within 1 hour —
# indicates a systemic pipeline issue, not an isolated failure.
# ─────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "high_deployment_failure_rate" {
  alarm_name          = "${local.name_prefix}-high-deployment-failure-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "DeploymentFailed"
  namespace           = "DevDeploy/Deployments"
  period              = 3600
  statistic           = "Sum"
  threshold           = 3
  alarm_description   = "More than 3 deployment failures in the last hour — possible pipeline issue"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]

  tags = {
    Name = "${local.name_prefix}-high-deployment-failure-rate"
  }
}