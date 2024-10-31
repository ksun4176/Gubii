terraform {
  required_version = "1.9.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

locals {
  botenv_source = ".env"
}

resource "aws_key_pair" "sshkey" {
  key_name   = "sshkey"
  public_key = file("../sshkey.pub")
}

# Default VPC
resource "aws_default_vpc" "main" {
  tags = {
    Name = "main"
  }
}

# All availability zones in region
data "aws_availability_zones" "available_zones" {}

# Subnets
resource "aws_default_subnet" "public_a" {
  availability_zone = data.aws_availability_zones.available_zones.names[0]
  
  tags = {
    Name = "public subnet a"
  }
}

resource "aws_default_subnet" "public_b" {
  availability_zone = data.aws_availability_zones.available_zones.names[1]
  
  tags = {
    Name = "public subnet b"
  }
}

resource "aws_default_subnet" "public_c" {
  availability_zone = data.aws_availability_zones.available_zones.names[2]
  
  tags = {
    Name = "public subnet c"
  }
}

resource "aws_subnet" "private_a" {
  vpc_id                  = aws_default_vpc.main.id
  cidr_block              = "172.31.96.0/20"
  map_public_ip_on_launch = "false"
  availability_zone       = data.aws_availability_zones.available_zones.names[0]

  tags = {
    Name = "private subnet a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id                  = aws_default_vpc.main.id
  cidr_block              = "172.31.112.0/20"
  map_public_ip_on_launch = "false"
  availability_zone       = data.aws_availability_zones.available_zones.names[1]

  tags = {
    Name = "private subnet b"
  }
}

# Route Tables
resource "aws_route_table" "main_private" {
  vpc_id = aws_default_vpc.main.id

  tags = {
    Name = "main private"
  }
}

# Route Tables Association
resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.main_private.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.main_private.id
}

# IAM roles
resource "aws_iam_role" "ecs_exec_role" {
  name_prefix         = "ecs-exec-role"
  assume_role_policy  = data.aws_iam_policy_document.assume_task_role_policy.json
}

# IAM policy document
data "aws_iam_policy_document" "assume_task_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# IAM attachments
resource "aws_iam_role_policy_attachment" "ecs_exec_role_policy" {
  role       = aws_iam_role.ecs_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

module "rds" {
  source = "./rds"
  sshkey_name = aws_key_pair.sshkey.key_name
  public_subnets = [aws_default_subnet.public_a.id, aws_default_subnet.public_b.id, aws_default_subnet.public_c.id]
  private_subnets = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  db_username = var.db_username
  db_password = var.db_password
}

module "s3" {
  source = "./s3"
  iam_exec_role_name = aws_iam_role.ecs_exec_role.name
  private_route_table_id = aws_route_table.main_private.id
  botenv_source = local.botenv_source
}

module "bot" {
  source = "./bot"
  iam_exec_role_name = aws_iam_role.ecs_exec_role.name
  iam_exec_role_arn = aws_iam_role.ecs_exec_role.arn
  # sshkey_name = aws_key_pair.sshkey.key_name
  public_subnets = [aws_default_subnet.public_a.id, aws_default_subnet.public_b.id, aws_default_subnet.public_c.id]
  # private_subnets = [aws_subnet.private_a.id, aws_subnet.private_b.id]
  bot_port = 80
  bot_name = "bot-task"
  bot_envfile_arn = module.s3.envfile_arn
}