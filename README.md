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
3. Get `secret.tfvars`, `jumpbox-key`, `.env` from ME. These contains credentials needed.
4. Call `terraform apply -var-file="secret.tfvars" -auto-approve` to create your infrastructure

## Database Setup
The initial state of the database is built using Prisma. If you need to create a test database:
1. Duplicate `.env.example` to `sql_database/.env` and fill in the variables.
2. Go to `sql_database/` folder to finish the setup.

## Bot Setup
The discord bot is hosted using Node.js and Docker. If you want to create a test bot:
1. Duplicate `.env.example` to `discord_bot/.env` and fill in the variables.
2. Go to `discord_bot/` folder to finish the setup.