module "backend" {
  source = "./modules/aws-project-backend"

  project_name               = var.project_name
  environment                = var.environment
  aws_region                 = var.aws_region
  frontend_url               = var.frontend_url
  additional_allowed_origins = var.additional_allowed_origins

  lambda_zip_path       = var.lambda_zip_path
  node_env              = var.node_env
  log_retention_in_days = var.log_retention_in_days
}
