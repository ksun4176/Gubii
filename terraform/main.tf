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

# Latest AMI from amazon
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-ebs"]
  }
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

# IAM instance profile
resource "aws_iam_instance_profile" "ecs_role" {
  name = "ecs-task-execution-profile"
  role = aws_iam_role.ecs_role.name
}

# IAM roles
resource "aws_iam_role" "ecs_role" {
  name                = "ecs-task-execution-role"
  assume_role_policy  = data.aws_iam_policy_document.assume_role_policy.json
}

# IAM policy documents
data "aws_iam_policy_document" "assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

module "rds" {
  source = "./rds"
  vpc_id = aws_default_vpc.main.id
  ami_id = data.aws_ami.amazon_linux_2.id
  sshkey_name = aws_key_pair.sshkey.key_name
  public_subnet_a_id = aws_default_subnet.public_a.id
  private_subnet_a_id = aws_subnet.private_a.id
  private_subnet_b_id = aws_subnet.private_b.id
  db_username = var.db_username
  db_password = var.db_password
}

module "s3" {
  source = "./s3"
  vpc_id = aws_default_vpc.main.id
  iam_role_name = aws_iam_role.ecs_role.name
  private_route_table_id = aws_route_table.main_private.id
}

module "bot" {
  source = "./bot"
  vpc_id = aws_default_vpc.main.id
  iam_role_name = aws_iam_role.ecs_role.name
  iam_instance_profile_name = aws_iam_instance_profile.ecs_role.name
  iam_role_arn = aws_iam_role.ecs_role.arn
  ami_id = data.aws_ami.amazon_linux_2.id
  sshkey_name = aws_key_pair.sshkey.key_name
  public_subnet_a_id = aws_default_subnet.public_a.id
  public_subnet_b_id = aws_default_subnet.public_b.id
  public_subnet_c_id = aws_default_subnet.public_c.id
  private_subnet_a_id = aws_subnet.private_a.id
  private_subnet_b_id = aws_subnet.private_b.id
  bot_port = 3000
  bot_name = "bot-task"
  bot_envfile_arn = module.s3.envfile_arn
}