# Terraform Railway — CRM Symbiose

## What Terraform Manages

| Resource | File |
|----------|------|
| CRM API (service + domain + variables) | `services.tf` |
| crm_worker (service + variables) | `services.tf` |
| Outputs (service IDs, URL) | `outputs.tf` |

**Postgres and Redis are managed manually** — the provider does not support volumes or start commands, and they are stateful services. Their URLs are injected via Railway References (`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`).

---

## Railway Project

```hcl
project_id     = "43cdc4c7-2119-4dc5-8168-e49510e330a1"
environment_id = "33fdf604-2086-4df5-8673-5b45d81a0588"
```

Project `crmt-twenty`, environment `production`, region US West.

---

## Prerequisites — run once before the first deploy

### 1. Postgres and Redis in Railway Dashboard

**Postgres:**
- Source Image: `ghcr.io/railwayapp-templates/postgres-ssl:18`
- Volume → mount path: `/var/lib/postgresql/data`
- Variables: `POSTGRES_PASSWORD`, `PGDATA=/var/lib/postgresql/data/pgdata`

**Redis:**
- Source Image: `redis:8.2.1`
- Volume → mount path: `/data`
- Start command: `redis-server --requirepass $REDIS_PASSWORD --maxmemory-policy noeviction --save 60 1`
- Variable: `REDIS_PASSWORD`

### 2. Railway Shared Variables

Automatically injected into all services in the environment. Must exist **before** the first deploy — the server crashes with `APP_SECRET is not set` otherwise.

```bash
railway variables set APP_SECRET="$(openssl rand -base64 32)"  --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
railway variables set EMAIL_SMTP_PASSWORD="app-password-gmail"  --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
railway variables set UNIPILE_API_KEY="your-key"                --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
railway variables set FULLENRICH_API_KEY="your-key"             --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
```

### 3. Terraform Cloud

- Organization: `jgomezdev`
- Workspace: `crm-railway-production` (CLI-driven mode)
- Sensitive environment variable: `RAILWAY_TOKEN` = Railway token with Account scope

Workspace variables (type terraform):

| Variable | Example |
|----------|---------|
| `public_domain` | `crmt-twenty.up.railway.app` |
| `node_env` | `production` |
| `port` | `3000` |
| `storage_type` | `local` |
| `is_fdw_enabled` | `false` |
| `auth_password_enabled` | `true` |
| `sign_in_prefilled` | `true` |
| `is_email_verification_required` | `false` |
| `auth_microsoft_enabled` | `false` |
| `microsoft_tenant_id` | `479a58aa-...` |
| `messaging_provider_microsoft_enabled` | `false` |
| `calendar_provider_microsoft_enabled` | `false` |
| `email_driver` | `smtp` |
| `email_from_address` | `you@gmail.com` |
| `email_from_name` | `CRM Symbiose` |
| `email_system_address` | `you@gmail.com` |
| `email_smtp_host` | `smtp.gmail.com` |
| `email_smtp_port` | `587` |
| `email_smtp_user` | `you@gmail.com` |
| `unipile_base_url` | `https://api37.unipile.com:16755` |
| `fullenrich_base_url` | `https://app.fullenrich.com/api/v2` |

### 4. GitHub Secrets

| Secret | Value |
|--------|-------|
| `RAILWAY_TOKEN` | Railway token with Account scope |
| `RAILWAY_API_SERVICE_ID` | `terraform output api_service_id` |
| `RAILWAY_WORKER_SERVICE_ID` | `terraform output worker_service_id` |
| `RAILWAY_ENVIRONMENT_ID` | `33fdf604-2086-4df5-8673-5b45d81a0588` |
| `TF_API_TOKEN` | Terraform Cloud user token |

---

## CD Pipeline (cd.yml)

```
Push to main
  ├── Job 0: Ensure Infrastructure  → terraform apply (idempotent)
  ├── Job 1: Build & Push Image     → Docker build + push to GHCR  [parallel with Job 0]
  ├── Job 2: Deploy API + Worker    → Railway GraphQL API redeploy  [waits for 0 and 1]
  └── Job 3: Smoke Test             → GET /health every 10s, max 5 min
```

Deploy uses the Railway GraphQL API directly (not Railway CLI) to avoid authentication issues in CI.

---

## Known Provider Bugs (`~> 0.4.0`)

**`railway_service_domain` fails to read after creation** — the domain is created in Railway but the provider reports a read error. Fix: run `terraform apply` a second time.

**`railway_variable` with environment_id as local** — reports `unknown value after apply` even though the variable is created correctly. Cosmetic only, does not fail the apply.

**RAILWAY_TOKEN** — use a token with **Account** scope in Railway. Project-scoped tokens return `Not Authorized` in Terraform Cloud.

---

## Commands

```bash
# Local authentication
export TF_TOKEN_app_terraform_io="<terraform-cloud-user-token>"
export RAILWAY_TOKEN="<railway-account-token>"

# Initial setup
terraform init

# Preview changes
terraform plan

# Apply
terraform apply

# Get service IDs (copy to GitHub Secrets)
terraform output

# Destroy CRM and Worker services (does NOT affect Postgres or Redis)
terraform destroy
```

---

## Docker Image

| Context | Image |
|---------|-------|
| Personal repo | `jgomez6242/symbiosecrm:latest` (Docker Hub) |
| Company repo | `ghcr.io/symbiosem/symbiosecrm:latest` (GHCR) |

When switching to GHCR, update `source_image` in `services.tf` and add the GitHub PAT as a Railway Shared Variable.

---

## Phase 6 — Microsoft OAuth (pending)

Requires an App Registration in Azure Portal.

**In Terraform Cloud**, set to `true`:
```
auth_microsoft_enabled
messaging_provider_microsoft_enabled
calendar_provider_microsoft_enabled
```

**In Railway Shared Variables:**
```bash
railway variables set AUTH_MICROSOFT_CLIENT_ID="..."     --environment production
railway variables set AUTH_MICROSOFT_CLIENT_SECRET="..." --environment production
```
