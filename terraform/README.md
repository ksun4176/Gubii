# Gubii Architecture
The architecture for Gubii. Here you can update the architecture in AWS.

## How to use
1. Make sure you have pre-requisites listed here completed
   https://developer.hashicorp.com/terraform/tutorials/aws-get-started/aws-build
2. Call `terraform init` to install dependencies
3. Get `../sshkey`, `secret.tfvars`, `.env` from ME. These contains credentials needed.
4. Call `terraform apply -var-file="secret.tfvars" -auto-approve` to update the infrastructure

## Technical Details
The architecture is built using Terraform.