# ─────────────────────────────────────────────
# STORAGE MODULE
# Creates: DynamoDB tables, S3 bucket, ECR repositories
# ─────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ─────────────────────────────────────────────
# DYNAMODB: USERS TABLE
# ─────────────────────────────────────────────

resource "aws_dynamodb_table" "users" {
  name         = "${var.project_name}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  attribute {
    name = "githubId"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "githubId-index"
    hash_key        = "githubId"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.project_name}-users"
  }
}

# ─────────────────────────────────────────────
# DYNAMODB: PROJECTS TABLE
# ─────────────────────────────────────────────

resource "aws_dynamodb_table" "projects" {
  name         = "${var.project_name}-projects"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "projectId"

  attribute {
    name = "projectId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.project_name}-projects"
  }
}

# ─────────────────────────────────────────────
# DYNAMODB: DEPLOYMENTS TABLE
# ─────────────────────────────────────────────

resource "aws_dynamodb_table" "deployments" {
  name         = "${var.project_name}-deployments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "deploymentId"
  range_key    = "projectId"

  attribute {
    name = "deploymentId"
    type = "S"
  }

  attribute {
    name = "projectId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  global_secondary_index {
    name            = "projectId-createdAt-index"
    hash_key        = "projectId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "userId-createdAt-index"
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.project_name}-deployments"
  }
}

# ─────────────────────────────────────────────
# DYNAMODB: ENVIRONMENTS TABLE
# TTL enabled for auto-destroy
# ─────────────────────────────────────────────

resource "aws_dynamodb_table" "environments" {
  name         = "${var.project_name}-environments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "environmentId"
  range_key    = "projectId"

  attribute {
    name = "environmentId"
    type = "S"
  }

  attribute {
    name = "projectId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  global_secondary_index {
    name            = "projectId-index"
    hash_key        = "projectId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    projection_type = "ALL"
  }

  # TTL — DynamoDB will automatically mark records
  # for deletion when the Unix timestamp in the
  # 'ttl' field has passed.
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${var.project_name}-environments"
  }
}

# ─────────────────────────────────────────────
# DYNAMODB: EVENTS TABLE
# Append-only audit log
# ─────────────────────────────────────────────

resource "aws_dynamodb_table" "events" {
  name         = "${var.project_name}-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "eventId"
  range_key    = "createdAt"

  attribute {
    name = "eventId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "deploymentId"
    type = "S"
  }

  global_secondary_index {
    name            = "deploymentId-createdAt-index"
    hash_key        = "deploymentId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  tags = {
    Name = "${var.project_name}-events"
  }
}

# ─────────────────────────────────────────────
# S3 BUCKET — Deployment artifacts and logs
# ─────────────────────────────────────────────

resource "aws_s3_bucket" "artifacts" {
  bucket = "${local.name_prefix}-artifacts-${var.aws_account_id}"

  tags = {
    Name = "${local.name_prefix}-artifacts"
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    id     = "delete-old-logs"
    status = "Enabled"

    filter {
      prefix = "logs/"
    }

    expiration {
      days = 30
    }
  }
}

# ─────────────────────────────────────────────
# ECR REPOSITORY — Backend API image
# ─────────────────────────────────────────────

resource "aws_ecr_repository" "api" {
  name                 = "${local.name_prefix}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${local.name_prefix}-api"
  }
}

# ─────────────────────────────────────────────
# ECR REPOSITORY — User application images
# ─────────────────────────────────────────────

resource "aws_ecr_repository" "user_apps" {
  name                 = "${local.name_prefix}-user-apps"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${local.name_prefix}-user-apps"
  }
}

# ECR Lifecycle Policy — Keep only last 10 images
# Prevents ECR storage costs from growing unbounded

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_lifecycle_policy" "user_apps" {
  repository = aws_ecr_repository.user_apps.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 20 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}