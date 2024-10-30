# Deployment region
data "aws_region" "current" {}

# Default VPC
resource "aws_default_vpc" "main" {
  tags = {
    Name = "main"
  }
}

########    ###    ########   ######      ###    ######## ######## 
##         ## ##   ##     ## ##    ##    ## ##      ##    ##       
##        ##   ##  ##     ## ##         ##   ##     ##    ##       
######   ##     ## ########  ##   #### ##     ##    ##    ######   
##       ######### ##   ##   ##    ##  #########    ##    ##       
##       ##     ## ##    ##  ##    ##  ##     ##    ##    ##       
##       ##     ## ##     ##  ######   ##     ##    ##    ######## 

# Security Group
resource "aws_security_group" "load_balancer" {
  vpc_id      = aws_default_vpc.main.id
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
  vpc_id      = aws_default_vpc.main.id
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
  subnets             = var.public_subnets
  security_groups     = [aws_security_group.load_balancer.id]

  tags = {
    Name = "bot-lb"
  }
}

resource "aws_lb_target_group" "bot_lb_tg" {
  name        = "bot-load-balancer-target-group"
  port        = var.bot_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_default_vpc.main.id

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

# ECR Repo
resource "aws_ecr_repository" "bot" {
  name          = "bot"
  force_delete  = true
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

# ECS Task
resource "aws_ecs_task_definition" "bot_td" {
  family                    = var.bot_name
  requires_compatibilities  = ["FARGATE"]
  network_mode              = "awsvpc"
  memory                    = 512
  cpu                       = 256
  execution_role_arn        = var.iam_exec_role_arn
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
    subnets           = var.public_subnets
    assign_public_ip  = true
    security_groups   = [aws_security_group.bot_service.id]
  }
}

########  ######   #######  
##       ##    ## ##     ## 
##       ##              ## 
######   ##        #######  
##       ##       ##        
##       ##    ## ##        
########  ######  #########

########    ###    #### ##       ##     ## ########  ######## 
##         ## ##    ##  ##       ##     ## ##     ## ##       
##        ##   ##   ##  ##       ##     ## ##     ## ##       
######   ##     ##  ##  ##       ##     ## ########  ######   
##       #########  ##  ##       ##     ## ##   ##   ##       
##       ##     ##  ##  ##       ##     ## ##    ##  ##       
##       ##     ## #### ########  #######  ##     ## ######## 

# resource "aws_ecs_cluster" "bot" {
#   name = "bot"
# }

# resource "aws_security_group" "bot_sg" {
#   name_prefix = "bot-sg-"
#   vpc_id      = aws_default_vpc.main.id

#   egress {
#     from_port   = 0
#     to_port     = 65535
#     protocol    = "tcp"
#     cidr_blocks = ["0.0.0.0/0"]
#   }
# }

# data "aws_ssm_parameter" "ecs_node_ami" {
#   name = "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id"
# }

# resource "aws_iam_instance_profile" "ecs_profile" {
#   name_prefix = "ecs-profile"
#   path        = "/ecs/instance/"
#   role        = aws_iam_role.ecs_role.name
# }

# resource "aws_iam_role" "ecs_role" {
#   name_prefix        = "ecs-role"
#   assume_role_policy = data.aws_iam_policy_document.assume_ec2_role_policy.json
# }

# data "aws_iam_policy_document" "assume_ec2_role_policy" {
#   statement {
#     actions = ["sts:AssumeRole"]
#     effect  = "Allow"

#     principals {
#       type        = "Service"
#       identifiers = ["ec2.amazonaws.com"]
#     }
#   }
# }

# resource "aws_iam_role_policy_attachment" "ecs_role_policy" {
#   role       = aws_iam_role.ecs_role.name
#   policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
# }

# resource "aws_launch_template" "bot_ec2" {
#   name_prefix            = "bot-ec2-"
#   image_id               = data.aws_ssm_parameter.ecs_node_ami.value
#   instance_type          = "t2.micro"
#   vpc_security_group_ids = [aws_security_group.bot_sg.id]

#   iam_instance_profile { arn = aws_iam_instance_profile.ecs_profile.arn }
#   monitoring { enabled = true }

#   user_data = base64encode(<<-EOF
#       #!/bin/bash
#       echo ECS_CLUSTER=${aws_ecs_cluster.bot.name} >> /etc/ecs/ecs.config;
#     EOF
#   )
# }

# resource "aws_autoscaling_group" "bot_asg" {
#   name_prefix               = "bot-asg-"
#   vpc_zone_identifier       = var.public_subnets
#   min_size                  = 1
#   max_size                  = 1
#   health_check_grace_period = 0
#   health_check_type         = "EC2"
#   protect_from_scale_in     = false

#   launch_template {
#     id      = aws_launch_template.bot_ec2.id
#     version = "$Latest"
#   }

#   tag {
#     key                 = "Name"
#     value               = "bot"
#     propagate_at_launch = true
#   }

#   tag {
#     key                 = "AmazonECSManaged"
#     value               = ""
#     propagate_at_launch = true
#   }
# }

# resource "aws_ecs_capacity_provider" "bot" {
#   name = "bot-ec2"

#   auto_scaling_group_provider {
#     auto_scaling_group_arn         = aws_autoscaling_group.bot_asg.arn
#     managed_termination_protection = "DISABLED"

#     managed_scaling {
#       maximum_scaling_step_size = 2
#       minimum_scaling_step_size = 1
#       status                    = "ENABLED"
#       target_capacity           = 100
#     }
#   }
# }

# resource "aws_ecs_cluster_capacity_providers" "bot" {
#   cluster_name       = aws_ecs_cluster.bot.name
#   capacity_providers = [aws_ecs_capacity_provider.bot.name]

#   default_capacity_provider_strategy {
#     capacity_provider = aws_ecs_capacity_provider.bot.name
#     base              = 1
#     weight            = 100
#   }
# }

# resource "aws_ecr_repository" "bot" {
#   name          = "bot"
#   force_delete  = true
# }

# resource "aws_iam_role" "ecs_task_role" {
#   name_prefix        = "ecs-task-role"
#   assume_role_policy = data.aws_iam_policy_document.assume_task_role_policy.json
# }

# data "aws_iam_policy_document" "assume_task_role_policy" {
#   statement {
#     actions = ["sts:AssumeRole"]
#     effect  = "Allow"

#     principals {
#       type        = "Service"
#       identifiers = ["ecs-tasks.amazonaws.com"]
#     }
#   }
# }

# resource "aws_cloudwatch_log_group" "bot_lg" {
#   name = "/bot/bot-task"
#   retention_in_days = 7
# }

# resource "aws_ecs_task_definition" "bot" {
#   family             = var.bot_name
#   task_role_arn      = aws_iam_role.ecs_task_role.arn
#   execution_role_arn = var.iam_exec_role_arn
#   network_mode       = "awsvpc"
#   cpu                = 256
#   memory             = 256

#   container_definitions = jsonencode([{
#     name         = "${var.bot_name}",
#     image        = "${aws_ecr_repository.bot.repository_url}:latest",
#     essential    = true,
#     portMappings  = [
#       {
#         containerPort = var.bot_port
#         hostPort      = var.bot_port
#       }
#     ],

#     environmentFiles: [
#       {
#           "value": "${var.bot_envfile_arn}"
#           "type": "s3"
#       }
#     ],

#     logConfiguration = {
#       logDriver = "awslogs"
#       options = {
#         awslogs-group         = "${aws_cloudwatch_log_group.bot_lg.name}"
#         awslogs-region        = "${data.aws_region.current.name}"
#         awslogs-stream-prefix = "bot"
#       }
#     }
#   }])
# }

# resource "aws_security_group" "bot" {
#   name_prefix = "bot-sg-"
#   description = "Allow all traffic within the VPC"
#   vpc_id      = aws_default_vpc.main.id

#   ingress {
#     from_port   = 0
#     to_port     = 0
#     protocol    = "-1"
#     cidr_blocks = [aws_default_vpc.main.cidr_block]
#   }

#   egress {
#     from_port   = 0
#     to_port     = 0
#     protocol    = -1
#     cidr_blocks = ["0.0.0.0/0"]
#   }
# }

# resource "aws_ecs_service" "bot" {
#   name            = "bot"
#   cluster         = aws_ecs_cluster.bot.id
#   task_definition = aws_ecs_task_definition.bot.arn
#   desired_count   = 1

#   network_configuration {
#     security_groups = [aws_security_group.bot.id]
#     subnets         = var.public_subnets
#   }

#   capacity_provider_strategy {
#     capacity_provider = aws_ecs_capacity_provider.bot.name
#     base              = 1
#     weight            = 100
#   }

#   load_balancer {
#     target_group_arn = aws_lb_target_group.bot_lb_tg.arn
#     container_name   = var.bot_name
#     container_port   = var.bot_port
#   }

#   lifecycle {
#     ignore_changes = [desired_count]
#   }
  
#   depends_on = [aws_lb_target_group.bot_lb_tg]
# }

# resource "aws_security_group" "load_balancer" {
#   name_prefix = "lb-sg-"
#   description = "security group for load balancer that allows HTTP/HTTPS port"
#   vpc_id      = aws_default_vpc.main.id

#   dynamic "ingress" {
#     for_each = [80, 443]
#     content {
#       from_port   = ingress.value
#       to_port     = ingress.value
#       protocol    = "tcp"
#       cidr_blocks = ["0.0.0.0/0"]
#     }
#   }

#   egress {
#     protocol    = "-1"
#     from_port   = 0
#     to_port     = 0
#     cidr_blocks = ["0.0.0.0/0"]
#   }
# }

# resource "aws_lb" "bot_lb" {
#   name               = "bot-lb"
#   load_balancer_type = "application"
#   subnets            = var.public_subnets
#   security_groups    = [aws_security_group.load_balancer.id]
  
#   tags = {
#     Name = "bot-lb"
#   }
# }

# resource "aws_lb_target_group" "bot_lb_tg" {
#   name_prefix = "bot-tg"
#   vpc_id      = aws_default_vpc.main.id
#   protocol    = "HTTP"
#   port        = var.bot_port
#   target_type = "ip"

#   health_check {
#     path                = "/"
#   }
# }

# resource "aws_lb_listener" "bot_lb_listener" {
#   load_balancer_arn = aws_lb.bot_lb.arn
#   port              = 80
#   protocol          = "HTTP"

#   default_action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.bot_lb_tg.arn
#   }
# }