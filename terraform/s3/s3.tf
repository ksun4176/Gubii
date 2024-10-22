# Deployment region
data "aws_region" "current" {}

# IAM policy attachment
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

resource "aws_iam_policy" "s3" {
  name = "s3-policy"
  policy = data.aws_iam_policy_document.s3.json
}

resource "aws_iam_role_policy_attachment" "s3_policy" {
  role        = var.iam_role_name
  policy_arn  = "${aws_iam_policy.s3.arn}"
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

# VPC endpoint
resource "aws_vpc_endpoint" "s3" {
  vpc_id          = var.vpc_id
  service_name    = "com.amazonaws.${data.aws_region.current.name}.s3"
  route_table_ids = [var.private_route_table_id]
  vpc_endpoint_type = "Gateway"

  tags = {
    Name = "bot-vpce-s3"
  }
}
