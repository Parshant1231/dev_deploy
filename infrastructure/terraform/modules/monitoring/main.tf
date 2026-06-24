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
          region  = var.aws_region
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
          region  = var.aws_region
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
          title   = "API Logs"
          query   = "SOURCE '/devdeploy/${var.environment}/api' | fields @timestamp, @message | sort @timestamp desc | limit 50"
          region  = var.aws_region
          view    = "table"
        }
      }
    ]
  })
}