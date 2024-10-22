# Gubii
A discord bot to handle building a guild structure for any game that you're playing

## DevOps
The architecture setup is built using Terraform. If you need to make changes to the architecture:
1. Duplicate `.env.example` to `terraform/.env` and fill in the variables.
2. Go to `terraform/` folder to finish this setup.

## Database Setup
The initial state of the database is built using Prisma. If you need to create a test database:
1. Duplicate `.env.example` to `sql_database/.env` and fill in the variables.
2. Go to `sql_database/` folder to finish the setup.

## Bot Setup
The discord bot is hosted using Node.js and Docker. If you want to create a test bot:
1. Duplicate `.env.example` to `discord_bot/.env` and fill in the variables.
2. Go to `discord_bot/` folder to finish the setup.