variable "iam_exec_role_name" {
  description = "Name of IAM role for task execution"
  type        = string
  sensitive   = true
}

variable "iam_exec_role_arn" {
  description = "ARN of IAM role for task execution"
  type        = string
  sensitive   = true
}

# variable "sshkey_name" {
#   description = "SSH Key name in the pair"
#   type        = string
#   sensitive   = true
# }

variable "public_subnets" {
  description = "Public subnets"
  type        = list(string)
  sensitive   = true
}

# variable "private_subnets" {
#   description = "Private subnets"
#   type        = list(string)
#   sensitive   = true
# }

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