variable "project_name" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }

variable "container_port" {
  description = "Port the API container listens on"
  type        = number
  default     = 3001
}

variable "deregistration_delay" {
  description = "Seconds the ALB waits before removing a draining target. Lower = faster rollouts."
  type        = number
  default     = 30
}
