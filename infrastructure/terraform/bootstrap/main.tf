# Bootstrap — Creates the S3 bucket and DynamoDB table
# that will store Terraform state for all other modules.
#
# Run this ONCE manually with local state.
# After this, all other modules use remote state.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "devdeploy"
      ManagedBy   = "terraform"
      Environment = "global"
    }
  }
}

# ─────────────────────────────────────────────
# S3 BUCKET — Terraform State Storage
# ─────────────────────────────────────────────
# This bucket stores the .tfstate files for every
# Terraform environment (dev, staging, production).
# Versioning is enabled so you can recover from
# accidental state corruption.

resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-terraform-state-${var.aws_account_id}"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────────
# DYNAMODB TABLE — State Locking
# ─────────────────────────────────────────────
# This table prevents concurrent terraform applies
# from corrupting the state file.
# When terraform apply starts, it writes a lock entry.
# When it finishes, it deletes the lock entry.
# If another apply tries to run, it sees the lock and waits.

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "${var.project_name}-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}