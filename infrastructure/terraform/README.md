# Penguin Tales Infrastructure

Terraform configuration for deploying penguin-tales static sites to AWS S3 + CloudFront.

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │          CloudFront CDN             │
                    │  ┌─────────────────────────────┐    │
User Request ──────▶│  │ /name-forge/* ──▶ S3       │    │
                    │  │ /* (future) ──▶ world-gen  │    │
                    │  └─────────────────────────────┘    │
                    └─────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │            S3 Bucket                │
                    │  ┌───────────────────────────────┐  │
                    │  │ /name-forge/                  │  │
                    │  │   ├── index.html              │  │
                    │  │   └── assets/...              │  │
                    │  │                               │  │
                    │  │ / (future: world-gen)         │  │
                    │  └───────────────────────────────┘  │
                    └─────────────────────────────────────┘
```

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.14 (required for Terraform Actions)
3. AWS Provider >= 6.22
4. Node.js and npm (for building the webui)
5. Route53 hosted zone for your domain (must already exist)

## Resources Created

- **ACM Certificate** with DNS validation via Route53
- **S3 Bucket** with versioning, encryption, and private access
- **S3 Objects** for all static assets (managed by Terraform)
- **CloudFront Distribution** with Origin Access Control
- **Route53 A Records** for apex and www subdomain

## Quick Start

```bash
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars if needed

./deploy.sh
```

## How It Works

The `deploy.sh` script:
1. Builds the webui with `DEPLOY_TARGET=aws` (sets base path to `/name-forge/`)
2. Runs `terraform init` and `terraform apply`

Terraform manages the static assets via `aws_s3_object` resources:
- Uses `fileset()` to find all files in `dist/`
- Uses `source_hash` (filemd5) to detect changes
- Automatically triggers CloudFront invalidation on updates via `action_trigger`

## Configuration

### Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS region | `us-east-1` |
| `prefix` | Project prefix for namespacing resources | `pt` |
| `domain_name` | Domain name | `penguin-tales.com` |

Resource names are derived from the prefix:
- S3 bucket: `{prefix}-static-{account_id}`
- CloudFront OAC: `{prefix}-oac`

Tags are applied automatically via provider `default_tags`.

## Outputs

- `website_url` - Full URL to access the site
- `cloudfront_distribution_id` - Distribution ID
- `s3_bucket_name` - Bucket name
- `acm_certificate_arn` - Certificate ARN
- `route53_zone_id` - Hosted zone ID

## Manual Cache Invalidation

```bash
terraform action aws_cloudfront_create_invalidation.invalidate_name_forge
terraform action aws_cloudfront_create_invalidation.invalidate_all
```

## Adding World-Gen (Future)

When world-gen is ready:
1. Add similar `aws_s3_object` resources for world-gen dist files
2. Update CloudFront `custom_error_response` paths
