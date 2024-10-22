# Deployment region
data "aws_region" "current" {}

# Security Group
resource "aws_security_group" "load_balancer" {
  vpc_id      = var.vpc_id
  name        = "load balancer security group"
  description = "security group for load balancer that allows internet port and all egress traffic"
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
  vpc_id      = var.vpc_id
  name        = "bot service security group"
  description = "security group for bot service that allows ingress load balancer traffic and all egress traffic"
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = -1
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.load_balancer.id]
  }
}

# Load Balancer
resource "aws_alb" "bot_lb" {
  name                = "bot-load-balancer"
  load_balancer_type  = "application"
  subnets = [
    var.public_subnet_a_id,
    var.public_subnet_b_id,
    var.public_subnet_c_id
  ]
  security_groups = [aws_security_group.load_balancer.id]

  tags = {
    Name = "bot-lb"
  }
}

resource "aws_lb_target_group" "bot_lb_tg" {
  name        = "bot-load-balancer-target-group"
  port        = var.bot_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    path = "/"
  }
}

resource "aws_lb_listener" "bot_lb_listener" {
  load_balancer_arn = aws_alb.bot_lb.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type              = "forward"
    target_group_arn  = aws_lb_target_group.bot_lb_tg.arn
  }
}
# IAM policy attachment
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role        = var.iam_role_name
  policy_arn  = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
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
resource "aws_cloudwatch_log_group" "bot_lg" {
  name = "/ecs/bot-task"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_stream" "bot_ls" {
  name           = "${aws_cloudwatch_log_group.bot_lg.name}-stream"
  log_group_name = "${aws_cloudwatch_log_group.bot_lg.name}"
}

# ECS Task
resource "aws_ecs_task_definition" "bot_td" {
  family                    = var.bot_name
  requires_compatibilities  = ["FARGATE"]
  network_mode              = "awsvpc"
  memory                    = 512
  cpu                       = 256
  execution_role_arn        = var.iam_role_arn
  container_definitions     = jsonencode([
    {
      name          = "${var.bot_name}"
      image         = "${aws_ecr_repository.bot.repository_url}"
      cpu           = 256
      memory        = 512
      essential     = true
      portMappings  = [
        {
          containerPort = var.bot_port
          hostPort      = var.bot_port
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "${aws_cloudwatch_log_group.bot_lg.name}"
          awslogs-region        = "${data.aws_region.current.name}"
          awslogs-stream-prefix = "ecs"
        }
      }
      environmentFiles: [
        {
            "value": "${var.bot_envfile_arn}"
            "type": "s3"
        }
      ]
    }
  ])
}

# ECS service
resource "aws_ecs_service" "bot_service" {
  name            = "bot-service"
  cluster         = aws_ecs_cluster.bot_cluster.id
  task_definition = aws_ecs_task_definition.bot_td.arn
  launch_type = "FARGATE"
  desired_count   = 1

  load_balancer {
    target_group_arn = aws_lb_target_group.bot_lb_tg.arn
    container_name = var.bot_name
    container_port = var.bot_port
  }

  network_configuration {
    subnets           = [
      var.public_subnet_a_id,
      var.public_subnet_b_id,
      var.public_subnet_c_id
    ]
    assign_public_ip = true
    security_groups   = [aws_security_group.bot_service.id]
  }
}