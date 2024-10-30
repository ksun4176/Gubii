variable "sshkey_name" {
  description = "SSH Key name in the pair"
  type        = string
  sensitive   = true
}

variable "public_subnets" {
  description = "Public subnets"
  type        = list(string)
  sensitive   = true
}

variable "private_subnets" {
  description = "Private subnets"
  type        = list(string)
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
