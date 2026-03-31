# Terraform Railway — CRM Symbiose

## Qué gestiona Terraform

| Recurso | Archivo |
|---------|---------|
| CRM API (servicio + dominio + variables) | `services.tf` |
| crm_worker (servicio + variables) | `services.tf` |
| Outputs (IDs de servicios, URL) | `outputs.tf` |

**Postgres y Redis son manuales** — el provider no soporta volúmenes ni start commands, y son servicios stateful. Sus URLs se inyectan via Railway References (`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`).

---

## Proyecto Railway

```hcl
project_id     = "43cdc4c7-2119-4dc5-8168-e49510e330a1"
environment_id = "33fdf604-2086-4df5-8673-5b45d81a0588"
```

Proyecto `crmt-twenty`, ambiente `production`, región US West.

---

## Prerequisitos — ejecutar una sola vez antes del primer deploy

### 1. Postgres y Redis en Railway Dashboard

**Postgres:**
- Source Image: `ghcr.io/railwayapp-templates/postgres-ssl:18`
- Volumen → mount path: `/var/lib/postgresql/data`
- Variables: `POSTGRES_PASSWORD`, `PGDATA=/var/lib/postgresql/data/pgdata`

**Redis:**
- Source Image: `redis:8.2.1`
- Volumen → mount path: `/data`
- Start command: `redis-server --requirepass $REDIS_PASSWORD --maxmemory-policy noeviction --save 60 1`
- Variable: `REDIS_PASSWORD`

### 2. Railway Shared Variables

Se inyectan automáticamente en todos los servicios del ambiente. Deben existir **antes** del primer deploy o el servidor falla con `APP_SECRET is not set`.

```bash
railway variables set APP_SECRET="$(openssl rand -base64 32)"  --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
railway variables set EMAIL_SMTP_PASSWORD="app-password-gmail"  --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
railway variables set UNIPILE_API_KEY="tu-key"                  --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
railway variables set FULLENRICH_API_KEY="tu-key"               --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
```

### 3. Terraform Cloud

- Organización: `jgomezdev`
- Workspace: `crm-railway-production` (modo CLI-driven)
- Variable sensitiva de entorno: `RAILWAY_TOKEN` = token Railway con scope Account

Variables de workspace (tipo terraform):

| Variable | Ejemplo |
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
| `email_from_address` | `correo@gmail.com` |
| `email_from_name` | `CRM Symbiose` |
| `email_system_address` | `correo@gmail.com` |
| `email_smtp_host` | `smtp.gmail.com` |
| `email_smtp_port` | `587` |
| `email_smtp_user` | `correo@gmail.com` |
| `unipile_base_url` | `https://api37.unipile.com:16755` |
| `fullenrich_base_url` | `https://app.fullenrich.com/api/v2` |

### 4. GitHub Secrets

| Secret | Valor |
|--------|-------|
| `RAILWAY_TOKEN` | Token Railway scope Account |
| `RAILWAY_API_SERVICE_ID` | `terraform output api_service_id` |
| `RAILWAY_WORKER_SERVICE_ID` | `terraform output worker_service_id` |
| `RAILWAY_ENVIRONMENT_ID` | `33fdf604-2086-4df5-8673-5b45d81a0588` |
| `TF_API_TOKEN` | Token de usuario de Terraform Cloud |

---

## Pipeline CD (cd.yml)

```
Push a main
  ├── Job 0: Ensure Infrastructure  → terraform apply (idempotente)
  ├── Job 1: Build & Push Image     → Docker build + push GHCR  [paralelo con Job 0]
  ├── Job 2: Deploy API + Worker    → Railway GraphQL API redeploy  [espera 0 y 1]
  └── Job 3: Smoke Test             → GET /health cada 10s, máx 5 min
```

El deploy usa Railway GraphQL API directamente (no Railway CLI) para evitar problemas de autenticación en CI.

---

## Bugs conocidos del provider `~> 0.4.0`

**`railway_service_domain` falla al leer después de crear** — el dominio se crea en Railway pero el provider reporta error en la lectura. Solución: correr `terraform apply` una segunda vez.

**`railway_variable` con environment_id como local** — reporta `unknown value after apply` aunque la variable se crea correctamente. Es cosmético, no falla el apply.

**RAILWAY_TOKEN** — usar token con scope **Account** en Railway. Tokens con scope de proyecto dan `Not Authorized` en Terraform Cloud.

---

## Comandos

```bash
# Autenticación local
export TF_TOKEN_app_terraform_io="<user-token-terraform-cloud>"
export RAILWAY_TOKEN="<railway-account-token>"

# Setup inicial
terraform init

# Verificar cambios
terraform plan

# Aplicar
terraform apply

# Ver IDs de servicios (copiar a GitHub Secrets)
terraform output

# Destruir servicios CRM y Worker (NO afecta Postgres ni Redis)
terraform destroy
```

---

## Imagen Docker

| Contexto | Imagen |
|----------|--------|
| Repo personal | `jgomez6242/symbiosecrm:latest` (Docker Hub) |
| Repo empresa | `ghcr.io/symbiosem/symbiosecrm:latest` (GHCR) |

Al usar GHCR, cambiar `source_image` en `services.tf` y agregar el PAT de GitHub como Railway Shared Variable.

---

## Fase 6 — Microsoft OAuth (pendiente)

Requiere App Registration en Azure Portal.

**En Terraform Cloud**, cambiar a `true`:
```
auth_microsoft_enabled
messaging_provider_microsoft_enabled
calendar_provider_microsoft_enabled
```

**En Railway Shared Variables:**
```bash
railway variables set AUTH_MICROSOFT_CLIENT_ID="..."     --environment production
railway variables set AUTH_MICROSOFT_CLIENT_SECRET="..." --environment production
```
