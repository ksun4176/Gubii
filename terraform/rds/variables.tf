variable "vpc_id" {
  description = "VPC"
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

variable "db_username" {
  description = "Database administrator username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database administrator password"
  type        = string
  sensitive   = true
}
