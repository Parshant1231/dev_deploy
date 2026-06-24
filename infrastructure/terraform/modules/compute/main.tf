# ─────────────────────────────────────────────
# COMPUTE MODULE
# Creates: ECS Cluster, ALB, Target Group,
#          ECS Task Definition, ECS Service
# ─────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ─────────────────────────────────────────────
# ECS CLUSTER
# A logical grouping of ECS tasks and services.
# Container Insights enables CloudWatch metrics
# for CPU and memory at the cluster level.
# ─────────────────────────────────────────────

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

# ─────────────────────────────────────────────
# APPLICATION LOAD BALANCER
# Sits in the public subnets.
# Receives traffic from the internet and
# routes it to ECS tasks in private subnets.
# ─────────────────────────────────────────────

resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = false

  tags = {
    Name = "${local.name_prefix}-alb"
  }
}

# ─────────────────────────────────────────────
# TARGET GROUP
# Defines how the ALB checks if ECS tasks are healthy.
# The ALB only routes traffic to healthy tasks.
# ─────────────────────────────────────────────

resource "aws_lb_target_group" "api" {
  name        = "${local.name_prefix}-api-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
    protocol            = "HTTP"
  }

  tags = {
    Name = "${local.name_prefix}-api-tg"
  }
}

# ─────────────────────────────────────────────
# ALB LISTENER
# Listens on port 80 and forwards to target group.
# In Phase 10, this will be upgraded to HTTPS.
# ─────────────────────────────────────────────

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ─────────────────────────────────────────────
# ECS TASK DEFINITION — Backend API
# Describes how to run the container:
# - Which Docker image to use
# - How much CPU and memory to allocate
# - Which IAM roles to attach
# - Which environment variables to pass
# - Where to send logs
# ─────────────────────────────────────────────

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
          containerPort = 3001
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
          value = "3001"
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        { name = "DYNAMODB_USERS_TABLE", value = var.users_table_name },
        { name = "DYNAMODB_PROJECTS_TABLE", value = var.projects_table_name },
        { name = "DYNAMODB_DEPLOYMENTS_TABLE", value = var.deployments_table_name },
        { name = "DYNAMODB_ENVIRONMENTS_TABLE", value = var.environments_table_name },
        { name = "DYNAMODB_EVENTS_TABLE", value = var.events_table_name },
      ]

      # SECRETS - pulled from Secrets Manager at container boot, never logged
      secrets = [
        {
          name      = "DEVDEPLOY_INTERNAL_KEY"
          valueFrom = "${var.app_secrets_arn}:DEVDEPLOY_INTERNAL_KEY::"
        },
        {
          name      = "JWT_SECRET"
          valueFrom = "${var.app_secrets_arn}:JWT_SECRET::"
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
        command     = ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
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

# ─────────────────────────────────────────────
# ECS SERVICE — Backend API
# Keeps the desired number of tasks running.
# Replaces unhealthy tasks automatically.
# Integrates with ALB for traffic routing.
# ─────────────────────────────────────────────

resource "aws_ecs_service" "api" {
  name            = "${local.name_prefix}-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3001
  }

  depends_on = [aws_lb_listener.http]

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  tags = {
    Name = "${local.name_prefix}-api-service"
  }
}