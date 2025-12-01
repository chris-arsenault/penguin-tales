#!/bin/bash
# deploy.sh - Build Canonry shell + all MFEs and deploy via Terraform
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

build_app() {
  local app_path="$1"
  echo "==> Building ${app_path}"
  cd "$REPO_ROOT/$app_path"

  # CRITICAL: Remove old build artifacts to prevent stale files
  # This ensures Terraform only sees current files via fileset()
  if [ -d "dist" ]; then
    echo "    Cleaning old dist directory..."
    rm -rf dist
  fi

  npm install
  npm run build
}

# Build remotes first, then the shell
build_app "apps/name-forge/webui"
build_app "apps/cosmographer/webui"
build_app "apps/coherence-engine/webui"
build_app "apps/lore-weave/webui"
build_app "apps/archivist/webui"
build_app "apps/canonry/webui"

# Deploy with Terraform
# Terraform will:
# 1. Upload all files to S3 with proper cache-control headers
# 2. Automatically trigger CloudFront invalidation via action_trigger
cd "$SCRIPT_DIR"
terraform init
terraform apply

echo ""
echo "==> Deployment complete!"
terraform output website_url
