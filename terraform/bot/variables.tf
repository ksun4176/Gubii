variable "vpc_id" {
  description = "VPC"
  type        = string
  sensitive   = true
}

variable "iam_role_name" {
  description = "Name of IAM role to attach task execution policy"
  type        = string
  sensitive   = true
}

variable "iam_instance_profile_name" {
  description = "Name of IAM instance profile linked to the IAM role"
  type        = string
  sensitive   = true
}

variable "iam_role_arn" {
  description = "Name of IAM role to attach task execution policy"
  type        = string
  sensitive   = true
}

variable "ami_id" {
  description = "AMI to use for instances"
  type        = string
  sensitive   = true
}

variable "sshkey_name" {
  description = "SSH Key name in the pair"
  type        = string
  sensitive   = true
}

variable "public_subnet_a_id" {
  description = "Public subnet A"
  type        = string
  sensitive   = true
}

variable "public_subnet_b_id" {
  description = "Public subnet B"
  type        = string
  sensitive   = true
}

variable "public_subnet_c_id" {
  description = "Public subnet C"
  type        = string
  sensitive   = true
}

variable "private_subnet_a_id" {
  description = "Private subnet A"
  type        = string
  sensitive   = true
}

variable "private_subnet_b_id" {
  description = "Private subnet B"
  type        = string
  sensitive   = true
}

variable "bot_port" {
  description = "Exposed port for bot"
  type        = number
  sensitive   = true
}

variable "bot_name" {
  description = "Container name for bot"
  type        = string
  sensitive   = true
}

variable "bot_envfile_arn" {
  description = "ARN of envfile in S3"
  type        = string
  sensitive   = true
}