# ─────────────────────────────────────────────
# SECURITY MODULE
# Creates: Security Groups, IAM Roles, IAM Policies
# ─────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ─────────────────────────────────────────────
# SECURITY GROUP: ALB
# The load balancer accepts traffic from the internet
# on ports 80 and 443 only.
# ─────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-alb-sg"
  }
}

# ─────────────────────────────────────────────
# SECURITY GROUP: ECS
# ECS tasks only accept traffic from the ALB.
# They should never be reachable from the internet.
# ─────────────────────────────────────────────

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Traffic from ALB only"
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
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

# ─────────────────────────────────────────────
# IAM ROLE: ECS TASK EXECUTION ROLE
#
# This role is used by the ECS AGENT (the AWS
# infrastructure layer) to:
# - Pull your Docker image from ECR
# - Write logs to CloudWatch
#
# Think of it as: what AWS needs to DO to run your container.
# ─────────────────────────────────────────────

resource "aws_iam_role" "ecs_execution_role" {
  name = "${local.name_prefix}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-execution-role"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ─────────────────────────────────────────────
# IAM ROLE: ECS TASK ROLE
#
# This role is used by YOUR APPLICATION CODE
# running inside the container to call AWS services:
# - Read/write to DynamoDB
# - Write to EventBridge
# - Read/write to S3
#
# Think of it as: what your app needs permission to DO.
# ─────────────────────────────────────────────

resource "aws_iam_role" "ecs_task_role" {
  name = "${local.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-task-role"
  }
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "${local.name_prefix}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/devdeploy-*",
          "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/devdeploy-*/index/*"
        ]
      },
      {
        Sid    = "EventBridgeAccess"
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = [
          "arn:aws:events:${var.aws_region}:${var.aws_account_id}:event-bus/devdeploy-*"
        ]
      },
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::devdeploy-*",
          "arn:aws:s3:::devdeploy-*/*"
        ]
      },
      {
        Sid    = "CloudWatchLogsAccess"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/devdeploy/*"
      },
      {
        Sid    = "ECRAccess"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECSManagement"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:CreateService",
          "ecs:UpdateService",
          "ecs:DeleteService",
          "ecs:DescribeServices",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RunTask",
          "ecs:StopTask"
        ]
        Resource = "*"
      },
      {
        Sid    = "IAMPassRole"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          "arn:aws:iam::${var.aws_account_id}:role/devdeploy-*"
        ]
      }
    ]
  })
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name = "${local.name_prefix}-app-secrets"
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    JWT_SECRET             = var.jwt_secret
    DEVDEPLOY_INTERNAL_KEY = var.internal_key
  })
}

resource "aws_iam_role_policy" "execution_secrets_access" {
  name = "${var.project_name}-${var.environment}-execution-secrets-policy"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.app_secrets.arn
      }
    ]
  })
}

# ─────────────────────────────────────────────
# IAM ROLE: LAMBDA EXECUTION ROLE
# Used by Lambda functions (auto-destroy, deploy handler)
# ─────────────────────────────────────────────

resource "aws_iam_role" "lambda_role" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-lambda-role"
  }
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_policy" {
  name = "${local.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DynamoDBAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/devdeploy-*",
          "arn:aws:dynamodb:${var.aws_region}:${var.aws_account_id}:table/devdeploy-*/index/*"
        ]
      },
      {
        Sid    = "ECSAccess"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DeleteService",
          "ecs:DescribeServices",
          "ecs:StopTask",
          "ecs:ListTasks"
        ]
        Resource = "*"
      }
    ]
  })
}

# ─────────────────────────────────────────────
# IAM POLICY: GitHub Actions EC2 Network Discovery
# Needed by deploy-user-app.yml to look up subnets
# and security groups when creating an ECS service.
# ─────────────────────────────────────────────

resource "aws_iam_role_policy" "github_actions_ec2_discovery" {
  name = "${local.name_prefix}-ec2-discovery-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EC2NetworkDiscovery"
        Effect = "Allow"
        Action = [
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeVpcs"
        ]
        Resource = "*"
      }
    ]
  })
}


# ─────────────────────────────────────────────
# GITHUB ACTIONS OIDC PROVIDER
#
# This tells AWS to trust GitHub's identity tokens.
# When GitHub Actions runs, it gets a JWT from GitHub.
# It sends that JWT to AWS STS.
# AWS verifies the JWT using GitHub's published public keys.
# AWS issues temporary credentials that expire in 1 hour.
#
# The thumbprint is GitHub's TLS certificate fingerprint.
# It ensures AWS only accepts tokens from GitHub's real servers.
# ─────────────────────────────────────────────

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # GitHub's OIDC thumbprint
  # This is a fixed value for GitHub Actions — does not change per account
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = {
    Name = "${local.name_prefix}-github-oidc"
  }
}

# ─────────────────────────────────────────────
# IAM ROLE — GitHub Actions
#
# GitHub Actions assumes this role during the pipeline.
# The trust policy restricts which GitHub repositories
# are allowed to assume this role.
#
# The condition "token.actions.githubusercontent.com:sub"
# locks the role to a specific repository and branch.
# This prevents other GitHub repos from assuming your role.
# ─────────────────────────────────────────────

resource "aws_iam_role" "github_actions" {
  name = "${local.name_prefix}-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            # Replace YOUR_GITHUB_USERNAME with your actual GitHub username
            # The * wildcard allows any branch to deploy
            # To restrict to main only: "repo:YOUR_GITHUB_USERNAME/devdeploy:ref:refs/heads/main"
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_username}/*:*"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-github-actions-role"
  }
}

# ─────────────────────────────────────────────
# IAM POLICY — GitHub Actions Permissions
#
# Principle of least privilege:
# Only the permissions GitHub Actions actually needs.
# ─────────────────────────────────────────────

resource "aws_iam_role_policy" "github_actions" {
  name = "${local.name_prefix}-github-actions-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
    {
      Sid    = "ECRAuthentication"
      Effect = "Allow"
      Action = "ecr:GetAuthorizationToken"
      Resource = "*"
    },
    {
      Sid    = "ECRImagePush"
      Effect = "Allow"
      Action = [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ]
      Resource = [
        "arn:aws:ecr:${var.aws_region}:${var.aws_account_id}:repository/devdeploy-*"
      ]
    },
    {
      Sid    = "ECSDeployment"
      Effect = "Allow"
      Action = [
        "ecs:RegisterTaskDefinition",
        "ecs:DeregisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:CreateService",
        "ecs:DeleteService",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:ListTaskDefinitions",
        "ecs:DescribeTasks",
        "ecs:ListTasks",
        "ecs:WaitUntilServicesStable"
      ]
      Resource = "*"
    },
    {
      Sid    = "ALBManagement"
      Effect = "Allow"
      Action = [
        "elasticloadbalancing:CreateTargetGroup",
        "elasticloadbalancing:DeleteTargetGroup",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:ModifyTargetGroupAttributes",
        "elasticloadbalancing:CreateRule",
        "elasticloadbalancing:DeleteRule",
        "elasticloadbalancing:DescribeRules",
        "elasticloadbalancing:ModifyRule",
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:RegisterTargets",
        "elasticloadbalancing:DeregisterTargets",
        "elasticloadbalancing:DescribeTargetHealth"
      ]
      Resource = "*"
    },
    {
      Sid    = "EC2NetworkQuery"
      Effect = "Allow"
      Action = [
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups"
      ]
      Resource = "*"
    },
    {
      Sid    = "CloudWatchLogs"
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups"
      ]
      Resource = "arn:aws:logs:${var.aws_region}:${var.aws_account_id}:log-group:/devdeploy/*"
    },
    {
      Sid    = "IAMPassRole"
      Effect = "Allow"
      Action = "iam:PassRole"
      Resource = [
        "arn:aws:iam::${var.aws_account_id}:role/devdeploy-*"
      ]
    },
    {
      Sid    = "STSIdentity"
      Effect = "Allow"
      Action = "sts:GetCallerIdentity"
      Resource = "*"
    }
  ]
  })
}