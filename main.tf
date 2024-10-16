terraform {
  required_version = "1.9.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  region                    = "us-east-1"
  bot_container_port        = 3000
  bot_task_name             = "bot-task"
  bot_task_cloudwatch_group = "/ecs/bot-task"
}

provider "aws" {
  region = "${local.region}"
}

# ssh key pair
resource "aws_key_pair" "jumpbox_key" {
  key_name   = "jumpbox-key"
  public_key = file("jumpbox-key.pub")
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
resource "aws_subnet" "public_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.16.0/24"
  map_public_ip_on_launch = "true"
  availability_zone = data.aws_availability_zones.available_zones.names[0]

  tags = {
    Name = "public subnet a"
  }
}

resource "aws_subnet" "public_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.32.0/24"
  map_public_ip_on_launch = "true"
  availability_zone = data.aws_availability_zones.available_zones.names[1]

  tags = {
    Name = "public subnet b"
  }
}

resource "aws_subnet" "public_c" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.48.0/24"
  map_public_ip_on_launch = "true"
  availability_zone = data.aws_availability_zones.available_zones.names[2]

  tags = {
    Name = "public subnet c"
  }
}

resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.64.0/24"
  map_public_ip_on_launch = "false"
  availability_zone = data.aws_availability_zones.available_zones.names[0]

  tags = {
    Name = "private subnet a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.80.0/24"
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

resource "aws_route_table" "main_private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "main private"
  }
}

# route tables association
resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.main_public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.main_public.id
}

resource "aws_route_table_association" "public_c" {
  subnet_id      = aws_subnet.public_c.id
  route_table_id = aws_route_table.main_public.id
}

resource "aws_route_table_association" "private_a" {
  subnet_id      = aws_subnet.private_a.id
  route_table_id = aws_route_table.main_private.id
}

resource "aws_route_table_association" "private_b" {
  subnet_id      = aws_subnet.private_b.id
  route_table_id = aws_route_table.main_private.id
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

resource "aws_security_group" "load_balancer" {
  vpc_id      = aws_vpc.main.id
  name = "load balancer security group"
  description = "security group for load balancer that allows bot port and all egress traffic"
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = -1
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "bot_service" {
  vpc_id      = aws_vpc.main.id
  name = "bot service security group"
  description = "security group for bot service that allows ingress load balancer traffic and all egress traffic"
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = -1
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    security_groups = ["${aws_security_group.load_balancer.id}"]
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
  subnet_id                   = aws_subnet.public_a.id

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

# ECR Repo
resource "aws_ecr_repository" "bot" {
  name = "bot-repo"
}

# ECS cluster
resource "aws_ecs_cluster" "bot_cluster" {
  name = "bot-cluster"
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "bot_task" {
  name = "${local.bot_task_cloudwatch_group}"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_stream" "bot_task" {
  name           = "${aws_cloudwatch_log_group.bot_task.name}-stream"
  log_group_name = "${aws_cloudwatch_log_group.bot_task.name}"
}

# ECS Task
resource "aws_ecs_task_definition" "bot_task" {
  family                    = "${local.bot_task_name}"
  container_definitions     = jsonencode([
    {
      name          = "${local.bot_task_name}"
      image         = "${aws_ecr_repository.bot.repository_url}"
      cpu           = 256
      memory        = 512
      essential     = true
      portMappings  = [
        {
          containerPort = local.bot_container_port
          hostPort      = local.bot_container_port
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "${aws_cloudwatch_log_group.bot_task.name}"
          awslogs-region        = "${local.region}"
          awslogs-stream-prefix = "ecs"
        }
      }
      environmentFiles: [
        {
            "value": "${aws_s3_object.envfile.arn}",
            "type": "s3"
        }
      ]
    }
  ])
  requires_compatibilities  = ["FARGATE"]
  network_mode              = "awsvpc"
  memory                    = 512
  cpu                       = 256
  execution_role_arn        =  aws_iam_role.ecs_task_execution_role.arn
}

# IAM roles
resource "aws_iam_role" "ecs_task_execution_role" {
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

data "aws_iam_policy_document" "s3" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject"
    ]
    resources = [
      "${aws_s3_object.envfile.arn}"
    ]
  }
}

# IAM policy
resource "aws_iam_policy" "s3" {
  name = "s3-policy"
  policy = data.aws_iam_policy_document.s3.json
}

# IAM policy attachment
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role        = aws_iam_role.ecs_task_execution_role.name
  policy_arn  = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy_attachment" "s3_policy" {
  role        = aws_iam_role.ecs_task_execution_role.name
  policy_arn  = "${aws_iam_policy.s3.arn}"
}

# load balancer
resource "aws_alb" "bot_lb" {
  name                = "bot-load-balancer"
  load_balancer_type  = "application"
  subnets = [
    "${aws_subnet.public_a.id}",
    "${aws_subnet.public_b.id}",
    "${aws_subnet.public_c.id}"
  ]
  security_groups = ["${aws_security_group.load_balancer.id}"]
}

resource "aws_lb_target_group" "bot_lb_tg" {
  name        = "bot-load-balancer-target-group"
  port        = local.bot_container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id
}

resource "aws_lb_listener" "bot_lb_listener" {
  load_balancer_arn = aws_alb.bot_lb.arn
  port              = "80"
  protocol          = "HTTP"
  default_action {
    type              = "forward"
    target_group_arn  = aws_lb_target_group.bot_lb_tg.arn
  }
}

# ECS service
resource "aws_ecs_service" "bot_service" {
  name            = "bot-service"
  cluster         = aws_ecs_cluster.bot_cluster.id
  task_definition = aws_ecs_task_definition.bot_task.arn
  launch_type = "FARGATE"
  desired_count = 1

  load_balancer {
    target_group_arn = aws_lb_target_group.bot_lb_tg.arn
    container_name = aws_ecs_task_definition.bot_task.family
    container_port = local.bot_container_port
  }

  network_configuration {
    subnets = [
      aws_subnet.public_a.id,
      aws_subnet.public_b.id,
      aws_subnet.public_c.id
    ]
    assign_public_ip = true
    security_groups = ["${aws_security_group.bot_service.id}"]
  }
}

# S3
resource "aws_s3_bucket" "bot" {
   bucket = "gubii-bot-s3"
   
   tags = {
    Name = "gubii-bot-s3"
   }
}

resource "aws_s3_object" "envfile" {
  bucket = aws_s3_bucket.bot.id
  key = "bot.env"
  source = ".env"
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id          = aws_vpc.main.id
  service_name    = "com.amazonaws.${local.region}.s3"
  route_table_ids = [aws_route_table.main_private.id]
  vpc_endpoint_type = "Gateway"

  tags = {
    Name = "bot-vpce-s3"
  }
}
