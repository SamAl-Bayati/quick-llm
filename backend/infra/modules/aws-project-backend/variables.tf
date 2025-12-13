variable "project_name" { type = string }
variable "environment"  { type = string }
variable "aws_region"   { type = string }

variable "frontend_url" { type = string }
variable "additional_allowed_origins" {
  type    = list(string)
  default = []
}

variable "lambda_zip_path" { type = string }
variable "node_env"        { type = string }

variable "log_retention_in_days" {
  type    = number
  default = 14
}
