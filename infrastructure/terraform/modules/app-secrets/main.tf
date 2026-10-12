# ─────────────────────────────────────────────
# APP-SECRETS MODULE
# Creates: the Secrets Manager secret holding runtime secrets.
# Values are supplied once at creation; later rotations are
# done in Secrets Manager and ignored by Terraform.
# ─────────────────────────────────────────────

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name = "${local.name_prefix}-app-secrets"
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id

  secret_string = jsonencode({
    JWT_SECRET             = var.jwt_secret
    DEVDEPLOY_INTERNAL_KEY = var.internal_key
    TOKEN_ENCRYPTION_KEY   = var.token_encryption_key
    GITHUB_CLIENT_ID       = var.github_client_id
    GITHUB_CLIENT_SECRET   = var.github_client_secret
    DEVDEPLOY_GITHUB_TOKEN = var.devdeploy_github_token
  })

  lifecycle {
    # Prevent terraform apply from overwriting manual rotations
    ignore_changes = [secret_string]
  }
}
