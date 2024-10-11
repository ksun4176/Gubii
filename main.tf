terraform {
  required_version = "1.9.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

#configure aws provider
provider "aws" {
  region = "us-east-1"
}

# ssh key pair
resource "aws_key_pair" "jumpbox_key" {
  key_name   = "jumpbox-key"
  public_key = file(".keys/jumpbox-key.pub")
}

# internet vpc
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  instance_tenancy     = "default"
  enable_dns_support   = "true"
  enable_dns_hostnames = "true"
  tags = {
    Name = "main"
  }
}

# get all avalablility zones in region
data "aws_availability_zones" "available_zones" {}

# subnets
resource "aws_subnet" "public" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.16.0/24"
  map_public_ip_on_launch = "true"
  availability_zone = data.aws_availability_zones.available_zones.names[0]

  tags = {
    Name = "public subnet"
  }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.32.0/24"
  map_public_ip_on_launch = "false"
  availability_zone = data.aws_availability_zones.available_zones.names[0]

  tags = {
    Name = "private subnet a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.48.0/24"
  map_public_ip_on_launch = "false"
  availability_zone = data.aws_availability_zones.available_zones.names[1]

  tags = {
    Name = "private subnet b"
  }
}

# internet gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "main"
  }
}

# route tables
resource "aws_route_table" "main_public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "main public"
  }
}

resource "aws_route_table" "rds_private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "rds private"
  }
}

# route tables association
resource "aws_route_table_association" "main_public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.main_public.id
}

resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.rds_private.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.rds_private.id
}

# security groups
resource "aws_security_group" "bastion_allow_ssh" {
  vpc_id      = aws_vpc.main.id
  name        = "bastion allow ssh"
  description = "security group for bastion that allows ssh and all egress traffic"
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = -1
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "bastion allow ssh"
  }
}

resource "aws_security_group" "rds" {
  vpc_id      = aws_vpc.main.id
  name        = "rds security group"
  description = "security group for RDS that allows DB port and all egress traffic"
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = -1
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "rds"
  }
}

# bastion
# get latest AMI from amazon
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-ebs"]
  }
}

# jump box instance
resource "aws_instance" "bastion" {
  ami                         = data.aws_ami.amazon_linux_2.id
  instance_type               = "t2.micro"
  key_name                    = aws_key_pair.jumpbox_key.key_name
  vpc_security_group_ids      = [aws_security_group.bastion_allow_ssh.id]
  subnet_id                   = aws_subnet.public.id

  tags = {
    Name = "bastion"
  }
}

# subnet group 
resource "aws_db_subnet_group" "rds_subnets" {
  name        = "gubii-db-subnets"
  subnet_ids  = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = {
    Name      = "Gubii DB Subnet Group"
  }
}

# RDS
resource "aws_db_instance" "default" {
  allocated_storage       = 10
  storage_type            = "gp2"
  engine                  = "mysql"
  engine_version          = "8.0"
  instance_class          = "db.t3.micro"
  identifier              = "gubiidb"
  username                = var.db_username
  password                = var.db_password
  vpc_security_group_ids  = [aws_security_group.rds.id]
  db_subnet_group_name    = aws_db_subnet_group.rds_subnets.name
  skip_final_snapshot     = true
}