# ─────────────────────────────────────────────
# LAMBDA MODULE
# Creates: auto-destroy Lambda function, CloudWatch log group,
#          EventBridge Scheduler rule (runs every 15 minutes).
# ─────────────────────────────────────────────

locals {
  name_prefix  = "${var.project_name}-${var.environment}"
  function_name = "${local.name_prefix}-auto-destroy"
  source_dir   = "${path.root}/../../../../infrastructure/lambda/auto-destroy"
}

# Package the Lambda source into a zip at plan time
data "archive_file" "auto_destroy" {
  type        = "zip"
  source_dir  = local.source_dir
  output_path = "${path.module}/auto_destroy.zip"
}

# ── LOG GROUP (created before the function so it has the right retention) ──
resource "aws_cloudwatch_log_group" "auto_destroy" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 14
  tags              = { Name = "${local.function_name}-logs" }
}

# ── LAMBDA FUNCTION ───────────────────────────
resource "aws_lambda_function" "auto_destroy" {
  function_name    = local.function_name
  role             = var.lambda_role_arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.auto_destroy.output_path
  source_code_hash = data.archive_file.auto_destroy.output_base64sha256

  timeout     = 300  # 5 minutes — enough for full teardown
  memory_size = 256

  environment {
    variables = {
      # AWS_REGION is reserved by Lambda — the runtime sets it automatically
      ENVIRONMENT        = var.environment
      ECS_CLUSTER        = var.ecs_cluster_name
      EVENT_BUS_NAME     = var.event_bus_name
      ENVIRONMENTS_TABLE = var.environments_table_name
      DEPLOYMENTS_TABLE  = var.deployments_table_name
      EVENTS_TABLE       = var.events_table_name
    }
  }

  depends_on = [aws_cloudwatch_log_group.auto_destroy]

  tags = { Name = local.function_name }
}

# ── EVENTBRIDGE SCHEDULER — every 15 minutes ──
resource "aws_cloudwatch_event_rule" "schedule" {
  name                = "${local.name_prefix}-auto-destroy-schedule"
  description         = "Trigger auto-destroy Lambda every 15 minutes"
  schedule_expression = "rate(15 minutes)"
  tags                = { Name = "${local.name_prefix}-auto-destroy-schedule" }
}

resource "aws_cloudwatch_event_target" "auto_destroy" {
  rule      = aws_cloudwatch_event_rule.schedule.name
  target_id = "AutoDestroyLambda"
  arn       = aws_lambda_function.auto_destroy.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auto_destroy.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.schedule.arn
}
