# Re-addresses resources that moved between modules during the alb/ecs/iam split.
# Terraform updates state only — nothing is destroyed or recreated.
# Safe to delete once every environment has applied this once.

moved {
  from = module.security.aws_security_group.alb
  to   = module.alb.aws_security_group.alb
}

moved {
  from = module.security.aws_security_group.ecs
  to   = module.ecs.aws_security_group.ecs
}

moved {
  from = module.security.aws_secretsmanager_secret.app_secrets
  to   = module.app_secrets.aws_secretsmanager_secret.app_secrets
}

moved {
  from = module.security.aws_secretsmanager_secret_version.app_secrets
  to   = module.app_secrets.aws_secretsmanager_secret_version.app_secrets
}

moved {
  from = module.security.aws_iam_role.ecs_execution_role
  to   = module.iam.aws_iam_role.ecs_execution_role
}

moved {
  from = module.security.aws_iam_role_policy_attachment.ecs_execution_role_policy
  to   = module.iam.aws_iam_role_policy_attachment.ecs_execution_role_policy
}

moved {
  from = module.security.aws_iam_role_policy.execution_secrets_access
  to   = module.iam.aws_iam_role_policy.execution_secrets_access
}

moved {
  from = module.security.aws_iam_role.ecs_task_role
  to   = module.iam.aws_iam_role.ecs_task_role
}

moved {
  from = module.security.aws_iam_role_policy.ecs_task_policy
  to   = module.iam.aws_iam_role_policy.ecs_task_policy
}

moved {
  from = module.security.aws_iam_role.lambda_role
  to   = module.iam.aws_iam_role.lambda_role
}

moved {
  from = module.security.aws_iam_role_policy_attachment.lambda_basic
  to   = module.iam.aws_iam_role_policy_attachment.lambda_basic
}

moved {
  from = module.security.aws_iam_role_policy.lambda_policy
  to   = module.iam.aws_iam_role_policy.lambda_policy
}

moved {
  from = module.security.aws_iam_openid_connect_provider.github_actions
  to   = module.iam.aws_iam_openid_connect_provider.github_actions
}

moved {
  from = module.security.aws_iam_role.github_actions
  to   = module.iam.aws_iam_role.github_actions
}

moved {
  from = module.security.aws_iam_role_policy.github_actions
  to   = module.iam.aws_iam_role_policy.github_actions
}

moved {
  from = module.compute.aws_lb.main
  to   = module.alb.aws_lb.main
}

moved {
  from = module.compute.aws_lb_target_group.api
  to   = module.alb.aws_lb_target_group.api
}

moved {
  from = module.compute.aws_lb_listener.http
  to   = module.alb.aws_lb_listener.http
}

moved {
  from = module.compute.aws_lb_listener_rule.api
  to   = module.alb.aws_lb_listener_rule.api
}

moved {
  from = module.compute.aws_ecs_cluster.main
  to   = module.ecs.aws_ecs_cluster.main
}

moved {
  from = module.compute.aws_ecs_cluster_capacity_providers.main
  to   = module.ecs.aws_ecs_cluster_capacity_providers.main
}

moved {
  from = module.compute.aws_ecs_task_definition.api
  to   = module.ecs.aws_ecs_task_definition.api
}

moved {
  from = module.compute.aws_ecs_service.api
  to   = module.ecs.aws_ecs_service.api
}
