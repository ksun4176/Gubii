variable "vpc_id" {
  description = "VPC"
  type        = string
  sensitive   = true
}

variable "iam_role_name" {
  description = "Name of IAM role to attach S3 policy"
  type        = string
  sensitive   = true
}

variable "private_route_table_id" {
  description = "ID of route table for private connections"
  type        = string
  sensitive   = true
}
