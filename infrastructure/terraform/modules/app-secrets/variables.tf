variable "project_name" { type = string }
variable "environment" { type = string }

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "internal_key" {
  type      = string
  sensitive = true
}

variable "token_encryption_key" {
  type      = string
  sensitive = true
}

variable "github_client_id" {
  type      = string
  sensitive = true
}

variable "github_client_secret" {
  type      = string
  sensitive = true
}

variable "devdeploy_github_token" {
  type      = string
  sensitive = true
  default   = ""
}
