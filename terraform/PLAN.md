# Terraform Railway — Plan de Implementación

## Contexto

Actualmente el deployment del CRM Twenty en Railway requiere **6 pasos manuales** en el dashboard y variables de entorno configuradas a mano. Este plan migra toda esa configuración a Terraform, de modo que `terraform apply` reemplace completamente el proceso manual documentado en `RAILWAY_SETUP_GUIDE.md`.

**Lo que NO cambia:** El pipeline de GitHub Actions (build → push a GHCR → `railway redeploy`) permanece igual. Terraform gestiona la infraestructura de Railway, no el deployment del código.

---

## Configuración Actual en Railway (Fuente de Verdad)

Esta sección documenta la configuración real de cada servicio en el proyecto `CRM Symbiose`, ambiente `production`. Es la referencia exacta para lo que Terraform debe replicar.

### Proyecto
| Campo | Valor |
|-------|-------|
| Nombre | `CRM Symbiose` |
| Ambiente | `production` |
| Región | US West (California, USA) |

---

### Registry de imágenes — Personal vs Trabajo

El origen de la imagen Docker varía según el contexto. Esto afecta `source_image` en `services.tf` y las credenciales en Railway Shared Variables.

| Contexto | Registry | Imagen | Credenciales Railway |
|----------|----------|--------|----------------------|
| **Repo personal** (`jorge6242/crm-twnty`) | Docker Hub | `jgomez6242/symbiosecrm:latest` | `RAILWAY_REGISTRY_AUTH_DOCKERHUB_USERNAME` + `RAILWAY_REGISTRY_AUTH_DOCKERHUB_PASSWORD` |
| **Repo trabajo** (`SymbioseM/SymbioseCRM`) | GHCR | `ghcr.io/symbiosem/symbiosecrm:latest` | `RAILWAY_REGISTRY_AUTH_GITHUB_USERNAME` + `RAILWAY_REGISTRY_AUTH_GITHUB_PASSWORD` (GitHub PAT con `read:packages`) |

**Al replicar en el repo de trabajo**, cambiar en `services.tf`:
```hcl
# Repo personal (Docker Hub)
source_image = "jgomez6242/symbiosecrm:latest"

# Repo trabajo (GHCR) — usar esto en producción
source_image = "ghcr.io/symbiosem/symbiosecrm:latest"
```

Y las Shared Variables correspondientes:
```bash
# Repo trabajo — GHCR
railway variables set RAILWAY_REGISTRY_AUTH_GITHUB_USERNAME="symbiosem" --environment production
railway variables set RAILWAY_REGISTRY_AUTH_GITHUB_PASSWORD="ghp_..." --environment production
```

---

### Servicio: CRM (API)

| Campo | Valor |
|-------|-------|
| Source Image | `ghcr.io/symbiosem/symbiosecrm:latest` |
| Registry Credentials | GitHub Access Token (PAT con `read:packages`) |
| Dominio público | `exemplary-solace-production-1bf7.up.railway.app` |
| Hostname privado | `exemplary-solace.railway.internal` |
| Pre-deploy command | `npm run migrate` |
| Start command | _(ninguno — usa el CMD del Dockerfile)_ |
| Healthcheck path | `/health` |
| Healthcheck timeout | `300` segundos |
| Restart policy | On Failure |
| Max restart retries | `10` |
| Replicas | `1` |
| Region | US West |
| Serverless | Desactivado |

---

### Servicio: crm_worker

| Campo | Valor |
|-------|-------|
| Source Image | `ghcr.io/symbiosem/symbiosecrm:latest` |
| Registry Credentials | GitHub Access Token (mismo PAT) |
| Dominio público | _(ninguno)_ |
| Hostname privado | `crmworker.railway.internal` |
| Pre-deploy command | _(ninguno)_ |
| Start command | `node dist/queue-worker/queue-worker` |
| Healthcheck path | _(ninguno)_ |
| Restart policy | On Failure |
| Max restart retries | `10` |
| Replicas | `1` |
| Region | US West |
| Serverless | Desactivado |

---

### Servicio: Postgres

| Campo | Valor |
|-------|-------|
| Source Image | `ghcr.io/railwayapp-templates/postgres-ssl:18` |
| Registry Credentials | _(ninguno — imagen pública)_ |
| Acceso TCP público | `crossover.proxy.rlwy.net:22392` → `:5432` |
| Hostname privado | `postgres.railway.internal` |
| Start command | _(ninguno — usa el CMD del contenedor)_ |
| Healthcheck | _(ninguno)_ |
| Restart policy | On Failure |
| Max restart retries | `10` |
| Replicas | `1` _(volumen adjunto — sin escalado horizontal)_ |
| Volumen | Montado (persistencia de datos) |

---

### Servicio: Redis

| Campo | Valor |
|-------|-------|
| Source Image | `redis:8.2.1` |
| Registry Credentials | _(ninguno — imagen pública)_ |
| Acceso TCP público | `crossover.proxy.rlwy.net:23846` → `:6379` |
| Hostname privado | `redis.railway.internal` |
| Start command | `/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --maxmemory-policy noeviction --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH"` |
| Healthcheck | _(ninguno)_ |
| Restart policy | On Failure |
| Max restart retries | `10` |
| Replicas | `1` _(volumen adjunto — sin escalado horizontal)_ |
| Volumen | Montado (persistencia de jobs BullMQ) |

> **Por qué `noeviction`:** BullMQ guarda jobs en Redis. Si Redis evicta keys bajo presión de memoria, los jobs se pierden silenciosamente. Con `noeviction`, Redis devuelve error en lugar de borrar datos — BullMQ lo maneja con reintentos.

---

## Estado Actual del Código Terraform

Ya existe una base en `terraform/`:
- `main.tf` — provider Railway, proyecto, los 4 servicios, variables
- `variables.tf` — `public_domain`, `app_secret`, `github_pat`

**Problemas identificados que deben corregirse:**
- La sintaxis de `railway_variable` con `variables = {}` probablemente no está soportada por el provider `~> 0.2.0` — requiere verificación
- Las referencias `railway_service.postgres.variables.DATABASE_URL` no existen como atributo en el provider — hay que investigar cómo se exponen
- Falta `restart_policy` y `max_retries` en todos los servicios
- Falta `replica_region` en todos los servicios
- Falta configuración de volúmenes para Postgres y Redis
- No existe `outputs.tf`
- No existe `.gitignore` — riesgo de commitear secrets o el tfstate
- No existe `terraform.tfvars.example`
- La configuración de registry credentials no está implementada

---

## Estructura Objetivo

```
terraform/
├── PLAN.md                    # Este documento
├── main.tf                    # Provider + backend (Terraform Cloud)
├── project.tf                 # railway_project
├── databases.tf               # Postgres + Redis (servicios, volúmenes, start commands)
├── services.tf                # API + Worker (imagen, deploy config, networking, env vars)
├── variables.tf               # Definición de inputs de config (no secrets)
├── outputs.tf                 # Service IDs, URLs (para GitHub Secrets)
├── terraform.tfvars           # Valores de config no-sensibles (commiteado)
├── terraform.tfvars.example   # Plantilla con claves vacías (referencia)
└── .gitignore                 # Excluir .terraform/, *.tfstate, *.tfstate.backup
```

> No existe `secrets.tfvars` — los secrets van directo a Railway via CLI como Shared Variables.

---

## Fases

### Fase 1 — Fundación y Validación del Provider

**Objetivo:** Validar qué recursos y atributos soporta el provider, y dejar la estructura limpia.

**Tareas:**
- [x] Consultar documentación del provider via Context7
- [x] Confirmar sintaxis correcta para recursos disponibles
- [x] Crear `.gitignore` en `terraform/`
- [x] Crear `terraform.tfvars.example` con todos los valores necesarios
- [x] Limpiar `main.tf` — dejar solo provider config, mover recursos a archivos separados

**Resultado:** `terraform init` exitoso con provider `v0.4.6`, estructura de archivos lista.

#### Hallazgos críticos del provider `terraform-community-providers/railway ~> 0.4.0`

> Estos hallazgos son esenciales para replicar en el repo original sin repetir los mismos errores.

**1. Namespace correcto del provider**
El namespace en la documentación es `terraform-community/railway` pero el correcto en el registry es `terraform-community-providers/railway`. Usar el incorrecto da error en `terraform init`.

**2. El provider NO soporta crear proyectos en cuentas personales**
`railway_project` con `team_id` falla con `Workspace not found` en cuentas personales de Railway. El campo `team_id` es para organizaciones/equipos, no para cuentas personales.

**Solución:** Crear el proyecto manualmente en Railway dashboard y referenciarlo por ID usando `locals` en `project.tf`:
```hcl
locals {
  project_id     = "ID_DEL_PROYECTO"
  environment_id = "ID_DEL_AMBIENTE"
}
```

**3. El provider tiene soporte limitado — solo gestiona:**
- `railway_service` (nombre + imagen + project_id)
- `railway_variable` (una variable por recurso)
- `railway_variable_collection` (batch de variables)
- `railway_tcp_proxy` (acceso TCP externo)
- `railway_service_domain` (dominio público)

**No soporta:** start commands, restart policy, volúmenes, healthcheck, pre-deploy commands, región específica, registry credentials privadas.

**4. Bug del provider con `railway_variable` cuando `environment_id` es un `local`**
El provider reporta error `unknown value after apply` para `.id` y `.project_id` aunque la variable SÍ se crea en Railway. Es un bug del provider, no un fallo real. La variable queda en el state y en Railway correctamente.

**5. El RAILWAY_TOKEN para Terraform debe ser el token de sesión del CLI**
Los API tokens creados en el dashboard de Railway con scope de workspace personal dan error `Workspace not found`. El token de sesión del CLI (`~/.railway/config.json → accessToken`) sí funciona. Para uso en CI/CD (Fase 5B), usar el token de sesión o investigar el tipo correcto de token para organizaciones.

---

### Fase 2 — Proyecto y Bases de Datos

**Objetivo:** Crear Postgres + Redis con configuración mínima funcional vía Terraform + pasos manuales post-apply.

**Tareas:**
- [x] Crear `project.tf` con locals (project_id + environment_id)
- [x] Crear `databases.tf` con Postgres, Redis y TCP proxies
- [x] Agregar `POSTGRES_PASSWORD` y `PGDATA` como `railway_variable`
- [x] Verificar que `terraform plan` y `terraform apply` no generan errores

**Pasos manuales post-apply (Railway Dashboard — una sola vez):**
- [x] Postgres: agregar volumen → mount path `/var/lib/postgresql/data`
- [x] Redis: agregar volumen → mount path `/data`
- [x] Redis: start command → `redis-server --requirepass $REDIS_PASSWORD --maxmemory-policy noeviction --save 60 1`
- [x] Redis: agregar variable `REDIS_PASSWORD` en Variables

**Resultado:** Postgres y Redis Online, con volúmenes persistentes y Redis con `noeviction`.

#### Hallazgos críticos de Fase 2

**1. La imagen `postgres-ssl:18` requiere `POSTGRES_PASSWORD` y `PGDATA`**
Sin `POSTGRES_PASSWORD` el contenedor crashea inmediatamente. Sin `PGDATA` apuntando al mount path del volumen, la imagen falla con `volume not mounted to correct path`. Ambas variables deben estar en Terraform desde el primer apply.

**2. El volumen de Postgres debe montarse en `/var/lib/postgresql/data`**
El mount path es crítico — la imagen valida que el volumen esté en ese path exacto.

**3. El start command de Redis con `--dir` falla en Railway**
Railway inyecta módulos adicionales (`--loadmodule`) en el config de Redis que colisionan con el flag `--dir`. El start command simplificado sin `--dir` funciona correctamente:
```
redis-server --requirepass $REDIS_PASSWORD --maxmemory-policy noeviction --save 60 1
```

**4. El hostname privado puede quedar con sufijo si hay conflicto de nombres**
Si un servicio anterior con el mismo nombre fue eliminado recientemente, Railway puede asignar `postgres-XXXX.railway.internal` en lugar de `postgres.railway.internal`. Verificar y corregir manualmente en Settings → Networking si es necesario.

---

### Fase 3 — Servicios: API y Worker

**Objetivo:** Crear ambos servicios con su configuración completa de deploy y networking.

**Tareas:**
- [ ] Crear `services.tf`:
  - **CRM (API):**
    - Imagen `ghcr.io/symbiosem/symbiosecrm:latest`
    - Registry credentials con GitHub PAT
    - Pre-deploy: `npm run migrate`
    - Healthcheck: `/health`, timeout `300`
    - Dominio público habilitado
    - Restart on failure, max retries `10`
    - Región US West, 1 replica
  - **crm_worker:**
    - Misma imagen + mismo PAT
    - Start command: `node dist/queue-worker/queue-worker`
    - Sin pre-deploy, sin healthcheck, sin dominio público
    - Restart on failure, max retries `10`
    - Región US West, 1 replica
- [ ] Confirmar que los servicios quedan en estado "waiting for deploy" (sin imagen deployada todavía)

**Resultado:** Ambos servicios en Railway, configurados y listos para recibir el primer deploy de GHCR.

---

### Fase 4 — Variables de Entorno: Patrón Híbrido

**Objetivo:** Separar config de secrets. Terraform gestiona la configuración reproducible. Railway gestiona los secrets sensibles como Shared Variables — sin que pasen por Terraform ni por CI/CD.

> Las variables se revisaron contra el código fuente de `packages/twenty-front` y `packages/twenty-server` para asegurar completitud.

---

#### Responsabilidades por herramienta

| Herramienta | Qué gestiona | Cómo se actualiza |
|-------------|--------------|-------------------|
| **Terraform** | Config no-sensible (URLs, flags, puertos, hosts) | `terraform apply` via PR |
| **Railway Shared Variables** | Secrets sensibles (API keys, passwords, JWT secret) | `railway variables set` via CLI, una sola vez |

> **Por qué no todo en Terraform:** Los secrets pasarían por el tfstate y por los logs de CI. Rotar una API key requeriría un `terraform apply`. Railway encripta sus variables y permite rotarlas al instante con un solo comando CLI.

---

#### Grupo A — Gestionado por Terraform (`railway_variable` resources)

Variables de configuración no-sensibles. Se commitean en `terraform.tfvars` y son reproducibles.

**Infraestructura base:**

| Variable | Valor | Dónde |
|----------|-------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway reference |
| `PG_DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway reference |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Railway reference |
| `NODE_ENV` | `production` | `terraform.tfvars` |
| `PORT` | `3000` | `terraform.tfvars` |
| `STORAGE_TYPE` | `local` | `terraform.tfvars` |
| `IS_FDW_ENABLED` | `false` | `terraform.tfvars` |

**URLs del servidor (deben coincidir exactamente):**

| Variable | Valor | Dónde |
|----------|-------|-------|
| `SERVER_URL` | `https://<public_domain>` | `terraform.tfvars` |
| `FRONT_BASE_URL` | `https://<public_domain>` | `terraform.tfvars` |
| `FRONTEND_URL` | `https://<public_domain>` | `terraform.tfvars` |
| `REACT_APP_SERVER_BASE_URL` | `https://<public_domain>` | `terraform.tfvars` |
| `TEMPORAL_BACKEND_BASE_URL` | `https://<public_domain>` | `terraform.tfvars` |

**Autenticación (flags):**

| Variable | Valor | Dónde |
|----------|-------|-------|
| `AUTH_PASSWORD_ENABLED` | `true` | `terraform.tfvars` |
| `SIGN_IN_PREFILLED` | `true` | `terraform.tfvars` |
| `IS_EMAIL_VERIFICATION_REQUIRED` | `false` | `terraform.tfvars` |
| `AUTH_MICROSOFT_ENABLED` | `false` _(hasta Fase 6)_ | `terraform.tfvars` |
| `MICROSOFT_TENANT_ID` | `479a58aa-145f-4e76-97a5-515e763b24f8` | `terraform.tfvars` |
| `MESSAGING_PROVIDER_MICROSOFT_ENABLED` | `false` _(hasta Fase 6)_ | `terraform.tfvars` |
| `CALENDAR_PROVIDER_MICROSOFT_ENABLED` | `false` _(hasta Fase 6)_ | `terraform.tfvars` |

**Email — config pública:**

| Variable | Valor | Dónde |
|----------|-------|-------|
| `EMAIL_DRIVER` | `smtp` | `terraform.tfvars` |
| `EMAIL_FROM_ADDRESS` | `jorge6242@gmail.com` | `terraform.tfvars` |
| `EMAIL_FROM_NAME` | `CRM Symbiose` | `terraform.tfvars` |
| `EMAIL_SYSTEM_ADDRESS` | `jorge6242@gmail.com` | `terraform.tfvars` |
| `EMAIL_SMTP_HOST` | `smtp.gmail.com` | `terraform.tfvars` |
| `EMAIL_SMTP_PORT` | `587` | `terraform.tfvars` |
| `EMAIL_SMTP_USER` | `jorge6242@gmail.com` | `terraform.tfvars` |

**Integraciones — URLs públicas:**

| Variable | Valor | Dónde |
|----------|-------|-------|
| `UNIPILE_BASE_URL` | `https://api37.unipile.com:16755` | `terraform.tfvars` |
| `FULLENRICH_BASE_URL` | `https://app.fullenrich.com/api/v2` | `terraform.tfvars` |

**Override exclusivo del Worker (hardcoded en `services.tf`):**

| Variable | Valor |
|----------|-------|
| `DISABLE_DB_MIGRATIONS` | `true` |
| `DISABLE_CRON_JOBS_REGISTRATION` | `true` |

---

#### Grupo B — Gestionado por Railway Shared Variables (CLI, una sola vez)

Secrets sensibles. **Nunca pasan por Terraform ni por CI/CD.** Se setean con Railway CLI a nivel de ambiente y quedan disponibles automáticamente para todos los servicios del proyecto.

```bash
# Ejecutar una sola vez después de terraform apply
# Los secrets quedan como Shared Variables del ambiente "production"

railway variables set APP_SECRET="cSJ7EfFnM/08XL96yN1..." --environment production
railway variables set EMAIL_SMTP_PASSWORD="rvgbsqegvuylqwbr"  --environment production
railway variables set UNIPILE_API_KEY="Zn9Noxpz.ZbXt/Q6W..."  --environment production
railway variables set FULLENRICH_API_KEY="cdfc5c04-b45f-42..."  --environment production
railway variables set GITHUB_PAT="ghp_..."                      --environment production

# Fase 6 — agregar cuando Azure App Registration esté listo:
# railway variables set AUTH_MICROSOFT_CLIENT_ID="..."     --environment production
# railway variables set AUTH_MICROSOFT_CLIENT_SECRET="..." --environment production
```

> Estos secrets se referencian en los servicios como `${{shared.APP_SECRET}}`, `${{shared.EMAIL_SMTP_PASSWORD}}`, etc. Railway los inyecta automáticamente en tiempo de ejecución.

**Para rotar un secret en el futuro:**
```bash
railway variables set APP_SECRET="nuevo_valor" --environment production
# Railway redeploya automáticamente los servicios afectados
```

---

#### Variables descartadas intencionalmente

Existen en el código pero no aplican para este setup:

| Variable | Razón |
|----------|-------|
| `AUTH_GOOGLE_*` | No se usa Google SSO |
| `STORAGE_S3_*` | `STORAGE_TYPE=local` |
| `SERVERLESS_*` | No se usa Lambda |
| `IS_BILLING_ENABLED` / `BILLING_STRIPE_*` | Billing desactivado |
| `CLICKHOUSE_URL` | Analytics no habilitado |
| `SENTRY_*` | No configurado |
| `CLOUDFLARE_*` | No aplica en Railway |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | No configurados aún |
| `SSL_KEY_PATH` / `SSL_CERT_PATH` | Railway maneja TLS |
| `PG_DATABASE_REPLICA_URL` | Sin réplica |
| `AWS_SES_*` | Se usa SMTP, no SES |

---

#### `terraform.tfvars` — estructura

```hcl
# terraform.tfvars — commiteado (sin valores sensibles)
public_domain                        = "exemplary-solace-production-1bf7.up.railway.app"
node_env                             = "production"
port                                 = "3000"
storage_type                         = "local"
is_fdw_enabled                       = "false"
auth_password_enabled                = "true"
sign_in_prefilled                    = "true"
is_email_verification_required       = "false"
auth_microsoft_enabled               = "false"
microsoft_tenant_id                  = "479a58aa-145f-4e76-97a5-515e763b24f8"
messaging_provider_microsoft_enabled = "false"
calendar_provider_microsoft_enabled  = "false"
email_driver                         = "smtp"
email_from_address                   = "jorge6242@gmail.com"
email_from_name                      = "CRM Symbiose"
email_system_address                 = "jorge6242@gmail.com"
email_smtp_host                      = "smtp.gmail.com"
email_smtp_port                      = "587"
email_smtp_user                      = "jorge6242@gmail.com"
unipile_base_url                     = "https://api37.unipile.com:16755"
fullenrich_base_url                  = "https://app.fullenrich.com/api/v2"
```

> No existe `secrets.tfvars` — los secrets van directo a Railway via CLI. Terraform no los necesita.

---

**Tareas:**
- [ ] Actualizar `variables.tf` con las variables del Grupo A únicamente
- [ ] Definir `railway_variable` resources para todas las variables del Grupo A
- [ ] Crear `terraform.tfvars.example` con las claves y valores de ejemplo (sin datos reales)
- [ ] Documentar los comandos `railway variables set` del Grupo B para el setup inicial
- [ ] Verificar que `terraform apply` popula el dashboard correctamente
- [ ] Ejecutar los comandos CLI del Grupo B para setear los secrets

**Resultado:** Config reproducible en Terraform. Secrets seguros en Railway sin pasar por CI/CD. Rotación de secrets con un solo comando CLI sin necesidad de `terraform apply`.

---

### Fase 5 — Outputs y Cierre de CI/CD

**Objetivo:** Eliminar la necesidad de copiar IDs manualmente del dashboard para GitHub Secrets.

**Outputs a exponer:**

| Output | Uso |
|--------|-----|
| `api_service_id` | → GitHub Secret `RAILWAY_API_SERVICE_ID` |
| `worker_service_id` | → GitHub Secret `RAILWAY_WORKER_SERVICE_ID` |
| `app_url` | URL pública del CRM |
| `project_id` | Referencia general |

**Tareas:**
- [ ] Crear `outputs.tf` con los 4 outputs
- [ ] Actualizar `RAILWAY_SETUP_GUIDE.md` — reemplazar los 6 pasos manuales con instrucciones de Terraform
- [ ] Corregir el diagrama duplicado en `DEPLOY_FLOW.MD`

**Resultado:** Setup completo = `terraform apply` + `terraform output` para copiar 3 valores a GitHub Secrets.

---

### Fase 5B — Estado Remoto + CI/CD con Terraform

**Objetivo:** Mover el `terraform.tfstate` de local a Terraform Cloud y agregar un workflow de GitHub Actions dedicado a Terraform, separado del deploy de código.

#### Por qué Terraform Cloud (no una DB en Railway)

El estado de Terraform necesita existir **antes** de que Terraform corra. Cualquier base de datos en Railway sería creada **por** Terraform — lo que genera una dependencia circular imposible de resolver. Terraform Cloud es externo a toda la infra gestionada, lo que rompe ese ciclo.

#### Prerequisito: Cuenta en Terraform Cloud

1. Crear cuenta gratuita en [app.terraform.io](https://app.terraform.io)
2. Crear una organización (ej. `symbiosem`)
3. Crear un workspace llamado `crm-railway-production` — modo **CLI-driven**
4. Generar un **API Token** de usuario o de equipo
5. Agregar ese token como `TF_API_TOKEN` en GitHub Secrets

#### Cambio en `main.tf` — backend remoto

Reemplazar el backend local por:

```hcl
terraform {
  cloud {
    organization = "symbiosem"
    workspaces {
      name = "crm-railway-production"
    }
  }
  required_providers {
    railway = {
      source  = "terraform-community/railway"
      version = "~> 0.2.0"
    }
  }
}
```

#### Nuevo workflow: `.github/workflows/terraform.yml`

**Trigger:** solo cuando cambian archivos en `terraform/**` — no corre en cada push de código.

```
En Pull Request (terraform/** cambia):
  1. terraform fmt -check     → valida formato
  2. terraform validate       → valida sintaxis
  3. terraform plan           → calcula cambios
     └── publica el plan como comentario en el PR

En merge a main (terraform/** cambia):
  4. Manual approval gate     → revisor aprueba el plan
  5. terraform apply          → aplica los cambios
```

**Secrets requeridos en GitHub Actions:**

| Secret | Valor | Origen |
|--------|-------|--------|
| `TF_API_TOKEN` | Token de Terraform Cloud | app.terraform.io |
| `RAILWAY_TOKEN` | Token del proyecto Railway | Railway dashboard |

> Con el patrón híbrido, los secrets sensibles (`APP_SECRET`, API keys, passwords) viven en Railway Shared Variables — no pasan por GitHub Actions ni por Terraform. El `terraform.yml` solo necesita 2 secrets.

#### Relación con `cd.yml` (sin cambios)

El `cd.yml` existente **no cambia**. Los dos pipelines son completamente independientes:

```
Cambió código  →  cd.yml corre   →  build + railway redeploy
Cambió infra   →  terraform.yml  →  plan + approval + apply
```

**Tareas:**
- [ ] Crear cuenta y workspace en Terraform Cloud
- [ ] Generar `TF_API_TOKEN` y agregarlo a GitHub Secrets
- [ ] Actualizar `main.tf` con el backend `cloud`
- [ ] Ejecutar `terraform init` para migrar el state local a Terraform Cloud
- [ ] Crear `.github/workflows/terraform.yml` con los jobs de plan y apply
- [ ] Configurar el **approval gate** con un GitHub Environment `terraform-production` y reviewer requerido

**Resultado:** Cambios de infraestructura revisados y aprobados antes de aplicarse. Estado seguro en Terraform Cloud. `cd.yml` sin tocar.

---

### Fase 6 — Microsoft OAuth (pendiente de configuración en Azure)

**Objetivo:** Activar la integración completa de Microsoft (login, mensajería, calendario) una vez que el App Registration en Azure esté configurado.

**Prerequisito externo:** Crear un App Registration en Azure Portal con los redirect URIs correctos hacia el dominio de Railway.

**Variables a agregar/actualizar:**

| Variable | Valor | Archivo |
|----------|-------|---------|
| `AUTH_MICROSOFT_ENABLED` | `true` | `terraform.tfvars` |
| `AUTH_MICROSOFT_CLIENT_ID` | _(del App Registration)_ | Railway Shared Variable (CLI) |
| `AUTH_MICROSOFT_CLIENT_SECRET` | _(del App Registration)_ | Railway Shared Variable (CLI) |
| `AUTH_MICROSOFT_CALLBACK_URL` | `https://<public_domain>/auth/microsoft/callback` | `terraform.tfvars` |
| `AUTH_MICROSOFT_APIS_CALLBACK_URL` | `https://<public_domain>/auth/microsoft-apis/callback` | `terraform.tfvars` |
| `MESSAGING_PROVIDER_MICROSOFT_ENABLED` | `true` | `terraform.tfvars` |
| `CALENDAR_PROVIDER_MICROSOFT_ENABLED` | `true` | `terraform.tfvars` |

**Tareas:**
- [ ] Crear App Registration en Azure Portal
- [ ] Configurar redirect URIs en Azure con el dominio de Railway
- [ ] Setear credentials via Railway CLI:
  ```bash
  railway variables set AUTH_MICROSOFT_CLIENT_ID="..."     --environment production
  railway variables set AUTH_MICROSOFT_CLIENT_SECRET="..." --environment production
  ```
- [ ] Actualizar `terraform.tfvars` — cambiar los 3 flags de `false` a `true`
- [ ] Ejecutar `terraform apply` para propagar los cambios de flags

**Resultado:** Login con Microsoft habilitado, sincronización de emails y calendario funcionando.

---

## Resumen

| Fase | Qué resuelve | Archivos principales |
|------|-------------|----------------------|
| 1 — Fundación | Provider validado, estructura limpia, sin riesgo de secrets en git | `.gitignore`, `tfvars.example`, refactor `main.tf` |
| 2 — Bases de datos | Proyecto + Postgres + Redis con `noeviction` y volúmenes | `project.tf`, `databases.tf` |
| 3 — Servicios | API + Worker con GHCR privado, restart policy, región | `services.tf` |
| 4 — Variables | Todas las env vars versionadas, secrets separados | `variables.tf`, `services.tf` |
| 5 — Outputs | CI/CD sin IDs manuales, documentación actualizada | `outputs.tf`, docs |
| 5B — Estado remoto + CI/CD | tfstate en Terraform Cloud, workflow separado para infra | `main.tf`, `terraform.yml` |
| 6 — Microsoft OAuth | Auth + mensajería + calendario Microsoft _(pendiente Azure)_ | `terraform.tfvars`, `secrets.tfvars` |

---

## Comandos de Referencia

```bash
# Inicializar provider (y conectar con Terraform Cloud)
terraform init

# Ver qué va a crear/cambiar sin aplicar
terraform plan -var-file="terraform.tfvars"

# Aplicar cambios
terraform apply -var-file="terraform.tfvars"

# Ver outputs (para copiar a GitHub Secrets)
terraform output

# Setear secrets en Railway (una sola vez, fuera de Terraform)
railway variables set APP_SECRET="..."           --environment production
railway variables set EMAIL_SMTP_PASSWORD="..."  --environment production
railway variables set UNIPILE_API_KEY="..."      --environment production
railway variables set FULLENRICH_API_KEY="..."   --environment production
railway variables set GITHUB_PAT="..."           --environment production

# Destruir toda la infraestructura (cuidado en producción)
terraform destroy -var-file="terraform.tfvars"
```

---

## Secrets requeridos

### GitHub Secrets (para CI/CD)

| Secret | Descripción |
|--------|-------------|
| `RAILWAY_TOKEN` | Token del proyecto Railway — ya existe ✓ |
| `RAILWAY_API_SERVICE_ID` | ID del servicio CRM — ya existe ✓ |
| `RAILWAY_WORKER_SERVICE_ID` | ID del servicio Worker — ya existe ✓ |
| `TF_API_TOKEN` | Token de Terraform Cloud — agregar en Fase 5B |

### Railway Shared Variables (vía CLI, no Terraform)

| Variable | Descripción |
|----------|-------------|
| `APP_SECRET` | JWT secret — `openssl rand -base64 32` |
| `EMAIL_SMTP_PASSWORD` | App password de Gmail |
| `UNIPILE_API_KEY` | API key de Unipile |
| `FULLENRICH_API_KEY` | API key de FullEnrich |
| `GITHUB_PAT` | PAT con `read:packages` para GHCR |
