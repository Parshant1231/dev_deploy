# ─────────────────────────────────────────────
# LAMBDA MODULE
# Creates: Lambda function, EventBridge Scheduler,
#          CloudWatch log group, IAM permissions
# ─────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ─────────────────────────────────────────────
# LAMBDA FUNCTION — Auto Destroy Scanner
#
# Runtime: Node.js 18.x (matches our backend)
# Handler: index.handler (file: index.js, function: handler)
# Timeout: 5 minutes (enough for teardown operations)
# Memory: 256MB (teardown is IO-bound, not compute-bound)
#
# The zip file is created from the Lambda source code
# in the infrastructure/lambda/ folder.
# ─────────────────────────────────────────────

data "archive_file" "auto_destroy" {
  type        = "zip"
  source_dir = "${path.module}/../../../lambda/auto-destroy"    
  output_path = "${path.module}/auto-destroy.zip"
}

resource "aws_lambda_function" "auto_destroy" {
  filename         = data.archive_file.auto_destroy.output_path
  function_name    = "${local.name_prefix}-auto-destroy"
  role             = var.lambda_role_arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  timeout          = 300
  memory_size      = 256
  source_code_hash = data.archive_file.auto_destroy.output_base64sha256

  environment {
    variables = {
      ENVIRONMENTS_TABLE  = var.environments_table_name
      DEPLOYMENTS_TABLE   = var.deployments_table_name
      EVENTS_TABLE        = var.events_table_name
      ECS_CLUSTER         = var.ecs_cluster_name
      EVENT_BUS_NAME      = var.event_bus_name
      AWS_ACCOUNT_ID_VAR  = var.aws_account_id
      ENVIRONMENT         = var.environment
      NODE_ENV            = "production"
    }
  }

  tags = {
    Name = "${local.name_prefix}-auto-destroy"
  }
}

resource "aws_cloudwatch_log_group" "auto_destroy" {
  name              = "/aws/lambda/${aws_lambda_function.auto_destroy.function_name}"
  retention_in_days = 30

  tags = {
    Name = "${local.name_prefix}-auto-destroy-logs"
  }
}

# ─────────────────────────────────────────────
# EVENTBRIDGE SCHEDULER
#
# Runs the Lambda every 15 minutes.
# Uses the newer EventBridge Scheduler (not CloudWatch Events).
# Scheduler is more flexible — supports time zones,
# one-time schedules, and flexible rate expressions.
#
# The scheduler needs its own IAM role to invoke Lambda.
# ─────────────────────────────────────────────

resource "aws_iam_role" "scheduler" {
  name = "${local.name_prefix}-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-scheduler-role"
  }
}

resource "aws_iam_role_policy" "scheduler" {
  name = "${local.name_prefix}-scheduler-policy"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = aws_lambda_function.auto_destroy.arn
      }
    ]
  })
}

resource "aws_scheduler_schedule" "auto_destroy" {
  name                         = "${local.name_prefix}-auto-destroy-schedule"
  description                  = "Runs auto-destroy scanner every 15 minutes"
  schedule_expression          = "rate(15 minutes)"
  schedule_expression_timezone = "UTC"

  # If a scheduled run misses its window (Lambda concurrency limit),
  # skip it — the next run will catch any missed environments.
  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.auto_destroy.arn
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      source = "scheduler"
      time   = "auto"
    })
  }
}

# Allow EventBridge Scheduler to invoke the Lambda
resource "aws_lambda_permission" "scheduler" {
  statement_id  = "AllowSchedulerInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auto_destroy.function_name
  principal     = "scheduler.amazonaws.com"
  source_arn    = aws_scheduler_schedule.auto_destroy.arn
}