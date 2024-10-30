# Default VPC
resource "aws_default_vpc" "main" {
  tags = {
    Name = "main"
  }
}

# Security Group
resource "aws_security_group" "rds" {
  vpc_id      = aws_default_vpc.main.id
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

resource "aws_security_group" "allow_ssh" {
  vpc_id      = aws_default_vpc.main.id
  name        = "allow ssh security group"
  description = "security group that allows ssh and all egress traffic"
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
    Name = "allow ssh"
  }
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

# Jump Box
resource "aws_instance" "bastion" {
  ami                     = data.aws_ami.amazon_linux_2.id
  instance_type           = "t2.micro"
  key_name                = var.sshkey_name
  vpc_security_group_ids  = [aws_security_group.allow_ssh.id]
  subnet_id               = element(var.public_subnets, 0)

  tags = {
    Name = "bastion"
  }
}

# Subnet Group 
resource "aws_db_subnet_group" "rds_subnets" {
  name        = "gubii-db-subnets"
  subnet_ids  = var.private_subnets

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