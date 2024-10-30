variable "iam_exec_role_name" {
  description = "Name of IAM role for task execution to attach S3 policy"
  type        = string
  sensitive   = true
}

variable "private_route_table_id" {
  description = "ID of route table for private connections"
  type        = string
  sensitive   = true
}

variable "botenv_source" {
  description = "relative file path to bot.env"
  type        = string
  sensitive   = true
}