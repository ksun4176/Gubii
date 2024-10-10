# Gubii
A discord bot to handle building a guild structure for any game that you're playing

## DevOps
We will be using Terraform to manage infrastructure and automate deployment.
For this project, we will be deploying:
- AWS RDS: Database with all information needed to run this project

### How to use
1. Make sure you have pre-requisites listed here completed
   https://developer.hashicorp.com/terraform/tutorials/aws-get-started/aws-build
2. Call `terraform init` to install dependencies
3. Duplicate `secret.tfvars.example` to `secret.tfvars` and fill in the variables
4. Call `terraform apply -var-file="secret.tfvars"` to create your infrastructure

## Database Setup
We will be using Prisma to build the initial state of the database. Go to `sql_database/` folder to learn more info.