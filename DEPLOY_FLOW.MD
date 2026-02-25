# CRM Deploy Flow

## Prerequisites (one-time setup)

- Bootstrap infrastructure (S3 backend + DynamoDB lock)
- ECR repository created (manual or via bootstrap Terraform)
- GitHub Secrets configured (DB, Redis, API keys)
- GitHub OIDC configured with AWS IAM role
- Route53 hosted zone (if using custom domain)

## AWS Managed Services

PostgreSQL and Redis are not deployed as containers in production. They run as AWS managed services, provisioned via Terraform before the first deploy.

### Amazon RDS (PostgreSQL)

- Engine: PostgreSQL 16
- Required extensions (enabled on first run via `setup-db.ts`):
  - `uuid-ossp` — supported natively by RDS
  - `unaccent` — supported natively by RDS
- `IS_FDW_ENABLED` must remain unset or `false` — the FDW extensions (`wrappers`, `mysql_fdw`) are not supported by RDS and are not needed for this CRM
- The DB instance must be accessible from App Runner (VPC + security group configuration)

### Amazon ElastiCache (Redis)

- Engine: Redis (standard mode, not cluster mode)
- Required parameter: `maxmemory-policy = noeviction` — critical for BullMQ to prevent job loss when memory is full
- Used for: caching, session storage, background job queues (BullMQ), GraphQL subscriptions (pub/sub), distributed locking
- A single ElastiCache instance is sufficient (`REDIS_URL`); `REDIS_QUEUE_URL` is optional for a dedicated queue instance

## GitHub Actions - CI (on each PR)

1. Checkout code
2. Setup Node + cache Yarn
3. Install dependencies
4. Lint (`npx nx affected:lint --base=origin/main`)
5. Typecheck (`npx nx affected:typecheck --base=origin/main`)
6. Build verification (`npx nx affected:build --base=origin/main`)

## GitHub Actions - CD (per environment)

> This flow applies to any environment (staging, production, etc.).
> Each environment runs it with its own configuration values (DB, image_uri, Terraform workspace, etc.).

1. AWS Login (OIDC, role assumption)
2. Build Docker image (context: root, dockerfile: `packages/twenty-docker/twenty/Dockerfile`)
   - Multi-stage build: compiles frontend and backend into a single image
   - Frontend is served as static files from the backend (`dist/front`)
   - One ECR repository for this image — no separate repos for postgres or redis
3. Tag: `sha-<7chars>_<env>` (e.g. `abc1234_staging`, `abc1234_production`)
4. Push image to ECR
5. Capture `image_uri` (e.g. `<account>.dkr.ecr.us-east-1.amazonaws.com/twenty-server:abc1234_staging`)
6. **[Manual approval]** — gate before any changes are applied to the environment
7. Run DB migrations (one-off container run against the environment's DB using the newly pushed image)
   - If it fails: pipeline stops, image is not deployed
   - Migrations must be backward-compatible (old and new instances run in parallel during rollout)
8. Terraform Plan (`-var="image_uri=$IMAGE_URI" -var="env=$ENV"`)
9. Terraform Apply
   - IAM roles/policies (App Runner execution + task roles)
   - App Runner Service
     - `image_uri` (variable from GitHub Actions)
     - `auto_scaling_configuration`
     - `instance_configuration` (CPU/RAM)
     - `health_check` (`/health` endpoint)
     - `environment_variables` (from TF vars reading SSM/Secrets)
   - Custom domain + ACM certificate (if applicable)
   - Route53 record (if applicable)
10. Outputs (`service_url`, `service_arn`)
11. Wait for readiness (30-60s)
12. Smoke tests (`curl $SERVICE_URL/health`)
13. **[If fails: rollback to previous image]**
14. Notify result (Slack/email)

## Structures

### Terraform

```
infra/
├── bootstrap/
│   ├── main.tf
│   └── README.md
├── modules/
│   └── app-runner/
│       ├── main.tf            # Shared App Runner logic
│       ├── variables.tf
│       └── outputs.tf
├── staging/
│   ├── main.tf                # Only calls the module
│   ├── backend.tf
│   └── terraform.tfvars
└── production/
    ├── main.tf                # Only calls the module
    ├── backend.tf
    └── terraform.tfvars
```
