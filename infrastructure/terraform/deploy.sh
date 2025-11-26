#!/bin/bash
# deploy.sh - Build name-forge and deploy via Terraform
set -e

cd "$(dirname "$0")"

# Build webui with AWS base path
cd ../../apps/name-forge/webui
npm install
DEPLOY_TARGET=aws npm run build
cd - > /dev/null

# Deploy with Terraform
terraform init
terraform apply

echo ""
terraform output website_url
