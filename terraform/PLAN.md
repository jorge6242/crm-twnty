# Terraform Railway — Plan de Implementación

## Contexto

Actualmente el deployment del CRM Twenty en Railway requiere **6 pasos manuales** en el dashboard y variables de entorno configuradas a mano. Este plan migra toda esa configuración a Terraform, de modo que `terraform apply` reemplace completamente el proceso manual documentado en `RAILWAY_SETUP_GUIDE.md`.

**Lo que NO cambia:** El pipeline de GitHub Actions (build → push a GHCR → redeploy vía Railway API) permanece igual. Terraform gestiona la infraestructura de Railway, no el deployment del código.

---

## Configuración Actual en Railway (Fuente de Verdad)

Esta sección documenta la configuración real de cada servicio en el proyecto `crmt-twenty`, ambiente `production`.

### Proyecto
| Campo | Valor |
|-------|-------|
| Nombre | `crmt-twenty` |
| Ambiente | `production` |
| project_id | `43cdc4c7-2119-4dc5-8168-e49510e330a1` |
| environment_id | `33fdf604-2086-4df5-8673-5b45d81a0588` |
| Región | US West (California, USA) |

---

### Servicios gestionados por Terraform

| Servicio | Qué hace Terraform |
|----------|--------------------|
| **CRM (API)** | Crea servicio, dominio público, todas las env vars de config |
| **crm_worker** | Crea servicio, todas las env vars de config + worker overrides |

### Servicios gestionados manualmente (NO Terraform)

| Servicio | Por qué manual |
|----------|----------------|
| **Postgres** | Stateful — riesgo de destrucción accidental de datos. El provider no soporta volúmenes, start commands ni healthcheck. |
| **Redis** | Mismo motivo. Volumen y start command configurados manualmente una sola vez. |

> Las URLs de Postgres y Redis se inyectan en CRM y Worker via **Railway References** (`${{Postgres.DATABASE_URL}}`, `${{Redis.REDIS_URL}}`), que Railway resuelve dinámicamente. Nunca están hardcodeadas.

---

### Registry de imágenes

| Contexto | Registry | Imagen |
|----------|----------|--------|
| **Repo personal** (`jorge6242/crm-twnty`) | Docker Hub | `jgomez6242/symbiosecrm:latest` |
| **Repo trabajo** (`SymbioseM/SymbioseCRM`) | GHCR | `ghcr.io/symbiosem/symbiosecrm:latest` |

---

## Estructura de Archivos

```
terraform/
├── PLAN.md                    # Este documento
├── main.tf                    # Provider + Terraform Cloud backend
├── project.tf                 # locals: project_id + environment_id
├── services.tf                # CRM API + Worker (servicio, dominio, variables)
├── variables.tf               # Definición de inputs (sin secrets)
├── outputs.tf                 # api_service_id, worker_service_id, app_url
├── terraform.tfvars.example   # Plantilla de referencia
└── .gitignore                 # Excluye .terraform/, *.tfstate, *.tfstate.backup
```

> `terraform.tfvars` local existe pero está en `.gitignore`. En CI/CD los valores viven en **Terraform Cloud** como workspace variables.
> No existe `databases.tf` — Postgres y Redis son manuales.

---

## Hallazgos Críticos del Provider

### Provider: `terraform-community-providers/railway ~> 0.4.0`

**1. Namespace correcto**
El registry usa `terraform-community-providers/railway`, no `terraform-community/railway`.

**2. El provider NO puede crear proyectos en cuentas personales**
`railway_project` con `team_id` falla en cuentas personales. Solución: crear el proyecto manualmente y referenciarlo por ID en `project.tf` via `locals`.

**3. El provider solo soporta recursos limitados**
- `railway_service` — nombre + imagen + project_id
- `railway_variable` / `railway_variable_collection` — variables por servicio
- `railway_tcp_proxy` — acceso TCP externo
- `railway_service_domain` — dominio público

**No soporta:** start commands, restart policy, volúmenes, healthcheck, pre-deploy commands, región específica, registry credentials privadas.

**4. Bug: `railway_variable` con `environment_id` como local**
El provider reporta error `unknown value after apply` para `.id` aunque la variable SÍ se crea correctamente en Railway. Es un bug del provider.

**5. Bug: `railway_service_domain` falla al leer después de crear**
El provider crea el dominio pero falla al confirmar la lectura. El dominio queda creado en Railway. Solución: correr `terraform apply` una segunda vez si ocurre — la segunda ejecución lo importa correctamente.

**6. RAILWAY_TOKEN para Terraform Cloud**
Usar un token de Railway con scope **Account** (sin restricción de workspace). Los tokens con scope de proyecto pueden tener problemas de autorización.

---

## Prerequisitos Antes del Primer Deploy

> **CRÍTICO:** Estos pasos deben completarse **antes** de que `cd.yml` corra por primera vez. Si los servicios se despliegan sin estas variables, el servidor crashea con `APP_SECRET is not set`.

### 1. Railway Shared Variables (una sola vez por ambiente)

Las Shared Variables son **nivel ambiente** — se inyectan automáticamente en todos los servicios presentes y futuros del ambiente `production`. No requieren asignación manual por servicio.

```bash
# Ejecutar una sola vez. Railway redeploya los servicios automáticamente.
railway variables set APP_SECRET="$(openssl rand -base64 32)"  --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
railway variables set EMAIL_SMTP_PASSWORD="app-password-gmail"  --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
railway variables set UNIPILE_API_KEY="tu-key"                  --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
railway variables set FULLENRICH_API_KEY="tu-key"               --environment production --project 43cdc4c7-2119-4dc5-8168-e49510e330a1
```

> Si los servicios son recreados por Terraform, heredan estas variables automáticamente en el siguiente deploy — sin intervención manual.

### 2. Postgres y Redis en Railway (una sola vez)

Crear manualmente desde Railway Dashboard:

**Postgres:**
- Source Image: `ghcr.io/railwayapp-templates/postgres-ssl:18`
- Agregar volumen → mount path `/var/lib/postgresql/data`
- Variables mínimas: `POSTGRES_PASSWORD`, `PGDATA=/var/lib/postgresql/data/pgdata`

**Redis:**
- Source Image: `redis:8.2.1`
- Agregar volumen → mount path `/data`
- Start command: `redis-server --requirepass $REDIS_PASSWORD --maxmemory-policy noeviction --save 60 1`
- Variable: `REDIS_PASSWORD`

### 3. GitHub Secrets

| Secret | Descripción | Origen |
|--------|-------------|--------|
| `RAILWAY_TOKEN` | Token Railway scope Account | Railway → Account Settings → Tokens |
| `RAILWAY_API_SERVICE_ID` | ID del servicio CRM | `terraform output api_service_id` |
| `RAILWAY_WORKER_SERVICE_ID` | ID del servicio Worker | `terraform output worker_service_id` |
| `RAILWAY_ENVIRONMENT_ID` | ID del ambiente production | `project.tf` → `local.environment_id` |
| `TF_API_TOKEN` | Token de Terraform Cloud | app.terraform.io → User Settings → Tokens |

### 4. Terraform Cloud — Workspace Variables

Las variables de configuración viven en Terraform Cloud (workspace `crm-railway-production`) en lugar de `terraform.tfvars`. Se configuran una sola vez via API o desde el dashboard de Terraform Cloud.

Variables requeridas (todas tipo `terraform`, no sensitivas):
`public_domain`, `node_env`, `port`, `storage_type`, `is_fdw_enabled`, `auth_password_enabled`, `sign_in_prefilled`, `is_email_verification_required`, `auth_microsoft_enabled`, `microsoft_tenant_id`, `messaging_provider_microsoft_enabled`, `calendar_provider_microsoft_enabled`, `email_driver`, `email_from_address`, `email_from_name`, `email_system_address`, `email_smtp_host`, `email_smtp_port`, `email_smtp_user`, `unipile_base_url`, `fullenrich_base_url`

Variable sensitiva (tipo `env`):
`RAILWAY_TOKEN`

---

## Pipeline de CI/CD

```
Push a main
  ├── Job 0: Ensure Infrastructure (Terraform apply)
  │          → Idempotente: 0 cambios si la infra existe
  │          → Recrea servicios si fueron borrados accidentalmente
  │
  ├── Job 1: Build & Push Image  (en paralelo con Job 0)
  │          → Build Docker image
  │          → Push a GHCR con tag sha-<commit> y latest
  │
  ├── Job 2: Deploy API + Worker  (espera Job 0 y Job 1)
  │          → Redeploy via Railway GraphQL API
  │          → Sin Railway CLI — evita problemas de autenticación
  │
  └── Job 3: Smoke Test
             → Health check en /health cada 10s, máx 5 minutos
```

> `terraform.yml` separado fue eliminado — Terraform corre en `cd.yml` en cada push a main como Job 0. Esto garantiza que la infra esté siempre en el estado deseado antes de cada deploy.

---

## Fases — Estado Final

### Fase 1 — Fundación ✅
Provider validado, estructura limpia, `.gitignore`, `tfvars.example`, `main.tf` refactorizado.

### Fase 2 — Bases de Datos ✅ (rediseñada)
**Decisión:** Postgres y Redis gestionados manualmente, no por Terraform.
- Eliminado `databases.tf`
- Razones: provider no soporta volúmenes/start commands, riesgo de destrucción accidental de datos stateful, hostnames dinámicos resueltos via Railway References
- Hallazgos de la implementación original preservados arriba como referencia

### Fase 3 — Servicios ✅
`services.tf` creado con CRM API y crm_worker. Railway References para DB/Redis URLs. Variables de worker overrides (`DISABLE_DB_MIGRATIONS`, `DISABLE_CRON_JOBS_REGISTRATION`).

### Fase 4 — Variables ✅
Patrón híbrido implementado. Config no-sensible en Terraform Cloud. Secrets en Railway Shared Variables.

### Fase 5 — Outputs ✅
`outputs.tf` creado. `terraform output` expone IDs de servicios y URL pública.

### Fase 5B — Estado Remoto + CI/CD ✅ (implementado diferente al plan original)
- Estado en Terraform Cloud (organización `jgomezdev`, workspace `crm-railway-production`)
- `terraform.yml` separado eliminado — Terraform integrado en `cd.yml` como Job 0
- Deploy via Railway GraphQL API en lugar de Railway CLI (más confiable en CI/CD)
- Variables de config en Terraform Cloud en lugar de `terraform.tfvars` commiteado

### Fase 6 — Microsoft OAuth ⏳
Pendiente de App Registration en Azure Portal.

---

## Comandos de Referencia

```bash
# Autenticación local
export TF_TOKEN_app_terraform_io="<user-token-terraform-cloud>"
export RAILWAY_TOKEN="<railway-account-token>"

# Inicializar (conecta con Terraform Cloud)
terraform init

# Ver cambios sin aplicar
terraform plan

# Aplicar cambios
terraform apply

# Ver outputs
terraform output

# Destruir infraestructura gestionada (NO destruye Postgres ni Redis)
terraform destroy
```

---

## Fase 6 — Microsoft OAuth (pendiente)

**Prerequisito:** App Registration en Azure Portal con redirect URIs al dominio de Railway.

**Variables a cambiar en Terraform Cloud:**
```
auth_microsoft_enabled               = true
messaging_provider_microsoft_enabled = true
calendar_provider_microsoft_enabled  = true
```

**Secrets a agregar en Railway Shared Variables:**
```bash
railway variables set AUTH_MICROSOFT_CLIENT_ID="..."     --environment production
railway variables set AUTH_MICROSOFT_CLIENT_SECRET="..." --environment production
```

**Resultado:** Login Microsoft, sincronización de emails y calendario activados.
