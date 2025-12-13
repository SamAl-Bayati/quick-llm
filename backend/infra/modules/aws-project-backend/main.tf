data "aws_caller_identity" "current" {}

locals {
  function_name = "${var.project_name}-${var.environment}"

  allowed_origins = distinct(concat(
    [var.frontend_url],
    var.additional_allowed_origins
  ))

  lambda_zip_abs = abspath(var.lambda_zip_path)
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${local.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lambda_policy" {
  statement {
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]

    resources = [
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${local.function_name}:*"
    ]
  }
}

resource "aws_iam_role_policy" "lambda_inline" {
  name   = "${local.function_name}-policy"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_policy.json
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_in_days
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${local.function_name}-http"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = local.allowed_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["content-type", "authorization"]
    allow_credentials = true
  }
}

resource "aws_lambda_function" "api" {
  function_name = local.function_name
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"

  filename         = local.lambda_zip_abs
  source_code_hash = filebase64sha256(local.lambda_zip_abs)

  timeout     = 15
  memory_size = 256

  environment {
    variables = {
      NODE_ENV = var.node_env

      DEV_BACKEND_URL  = aws_apigatewayv2_api.http.api_endpoint
      PROD_BACKEND_URL = aws_apigatewayv2_api.http.api_endpoint

      DEV_FRONTEND_URL  = var.frontend_url
      PROD_FRONTEND_URL = var.frontend_url

      ALLOWED_ORIGINS = join(",", distinct(concat(
        local.allowed_origins,
        [aws_apigatewayv2_api.http.api_endpoint]
      )))
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda]
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id = aws_apigatewayv2_api.http.id

  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 30000
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw_invoke" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
