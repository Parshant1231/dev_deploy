# ─────────────────────────────────────────────
# ECS MODULE
# Creates: ECS task security group, ECS cluster,
#          Fargate task definition, ECS service
# Tasks run in the private subnets and receive traffic
# only from the ALB.
# ─────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ECS security group — tasks accept traffic from the ALB only.
# The full port range is intentional: user applications deployed by the
# pipeline reuse this group and listen on different container ports.
resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Traffic from ALB only"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-ecs-sg"
  }
}

# Cluster — Container Insights gives CPU/memory metrics in CloudWatch
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${local.name_prefix}-cluster"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# Task definition — backend API
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_prefix}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  task_role_arn            = var.ecs_task_role_arn
  execution_role_arn       = var.ecs_execution_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${var.ecr_repository_url}:latest"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "PORT"
          value = tostring(var.container_port)
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        { name = "DYNAMODB_USERS_TABLE",        value = var.users_table_name },
        { name = "DYNAMODB_PROJECTS_TABLE",     value = var.projects_table_name },
        { name = "DYNAMODB_DEPLOYMENTS_TABLE",  value = var.deployments_table_name },
        { name = "DYNAMODB_ENVIRONMENTS_TABLE", value = var.environments_table_name },
        { name = "DYNAMODB_EVENTS_TABLE",       value = var.events_table_name },
        { name = "DEVDEPLOY_REPO_OWNER",        value = var.devdeploy_repo_owner },
        { name = "DEVDEPLOY_REPO_NAME",         value = var.devdeploy_repo_name },
        { name = "API_PUBLIC_URL",              value = var.api_public_url },
        { name = "EVENTBRIDGE_BUS_NAME",        value = var.event_bus_name },
        { name = "ECS_CLUSTER",                 value = var.ecs_cluster_name_for_env != "" ? var.ecs_cluster_name_for_env : "${var.project_name}-${var.environment}-cluster" },
        { name = "AUTO_DESTROY_FUNCTION_NAME",  value = var.auto_destroy_function_name },
        { name = "AWS_ACCOUNT_ID",              value = var.aws_account_id },
      ]

      # Secrets are pulled from Secrets Manager at container boot, never logged
      secrets = [
        {
          name      = "DEVDEPLOY_INTERNAL_KEY"
          valueFrom = "${var.app_secrets_arn}:DEVDEPLOY_INTERNAL_KEY::"
        },
        {
          name      = "JWT_SECRET"
          valueFrom = "${var.app_secrets_arn}:JWT_SECRET::"
        },
        {
          name      = "TOKEN_ENCRYPTION_KEY"
          valueFrom = "${var.app_secrets_arn}:TOKEN_ENCRYPTION_KEY::"
        },
        {
          name      = "GITHUB_CLIENT_ID"
          valueFrom = "${var.app_secrets_arn}:GITHUB_CLIENT_ID::"
        },
        {
          name      = "GITHUB_CLIENT_SECRET"
          valueFrom = "${var.app_secrets_arn}:GITHUB_CLIENT_SECRET::"
        },
        {
          name      = "DEVDEPLOY_GITHUB_TOKEN"
          valueFrom = "${var.app_secrets_arn}:DEVDEPLOY_GITHUB_TOKEN::"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = var.log_group_name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${local.name_prefix}-api-task"
  }
}

# Service — rolling deployments with automatic rollback.
# 100% minimum healthy + 200% maximum means ECS starts the new task and waits
# for it to pass health checks BEFORE stopping the old one (zero downtime).
# If new tasks keep failing, the circuit breaker rolls back to the last
# working task definition automatically.
resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  health_check_grace_period_seconds = 60
  force_new_deployment              = false

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = var.container_port
  }

  # The CI/CD pipeline registers new task definitions and scales the service;
  # Terraform must not revert those changes.
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = {
    Name = "${local.name_prefix}-api-service"
  }
}
