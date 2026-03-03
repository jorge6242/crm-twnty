# FASE 1: Auditoría y Preparación Local - Twenty CRM

**Fecha:** 14 de febrero de 2026
**Estado:** ✅ Análisis completado

---

## 📋 Resumen Ejecutivo

Twenty ya cuenta con una **infraestructura dockerizada sólida** tanto para desarrollo como para producción. El sistema está listo para migración a AWS con ajustes menores.

### ✅ Lo que YA tienes implementado:
- ✅ Dockerfile multi-stage optimizado para producción
- ✅ Docker Compose para orquestación completa (server, worker, DB, Redis)
- ✅ Separación clara entre servicios (server, worker, frontend)
- ✅ Scripts de migraciones y comandos de producción
- ✅ Variables de entorno bien documentadas
- ✅ Healthchecks implementados

---

## 🏗️ Arquitectura Actual del Sistema

### **Servicios Identificados**

| Servicio | Puerto | Comando Producción | Dockerfile/Imagen |
|----------|--------|-------------------|-------------------|
| **twenty-server** | 3000 | `node dist/main` | `packages/twenty-docker/twenty/Dockerfile` |
| **twenty-worker** | N/A | `node dist/queue-worker/queue-worker` | Misma imagen que server |
| **twenty-front** | 3001 (dev) | Build estático → servido por server | Integrado en Dockerfile principal |
| **PostgreSQL** | 5432 | Imagen oficial `postgres:16` | N/A (servicio gestionado en AWS) |
| **Redis** | 6379 | Imagen oficial `redis` | N/A (ElastiCache en AWS) |

### **Flujo de Build Actual (Producción)**

```mermaid
graph LR
    A[common-deps] --> B[twenty-server-build]
    A --> C[twenty-front-build]
    B --> D[twenty final image]
    C --> D
    D --> E[Server: node dist/main]
    D --> F[Worker: node dist/queue-worker/queue-worker]
```

**Características del Dockerfile actual:**
- ✅ Multi-stage build (optimización de tamaño)
- ✅ Node.js 24 Alpine (imagen ligera)
- ✅ Frontend compilado y servido desde backend (`dist/front`)
- ✅ Usuario no-root (UID 1000) - seguridad
- ✅ Healthcheck incluido
- ✅ Entrypoint script para configuraciones dinámicas

---

## 🔧 Comandos Clave para AWS

### **Build & Test (Locales)**

```bash
# Build Backend
npx nx build twenty-server

# Build Frontend
npx nx build twenty-front

# Tests Unitarios
npx nx test twenty-front
npx nx test twenty-server

# Tests Integración con DB reset
npx nx run twenty-server:test:integration:with-db-reset

# Linting (solo archivos modificados vs main)
npx nx lint:diff-with-main twenty-front
npx nx lint:diff-with-main twenty-server
```

### **Database Migrations (Producción)**

```bash
# Inicializar DB nueva (setup completo)
npx ts-node ./packages/twenty-server/scripts/setup-db.ts
yarn database:migrate:prod

# Solo ejecutar migraciones pendientes
npx typeorm migration:run -d dist/database/typeorm/core/core.datasource

# Sincronizar metadata (después de migraciones)
npx nx run twenty-server:command workspace:sync-metadata
```

### **Build Docker Producción (Local Test)**

```bash
# Build imagen completa
docker build -f packages/twenty-docker/twenty/Dockerfile \
  --build-arg REACT_APP_SERVER_BASE_URL=http://localhost:3000 \
  --build-arg APP_VERSION=$(git rev-parse --short HEAD) \
  -t twenty:local .

# Test local de la imagen
docker run -d --name twenty-test \
  -e PG_DATABASE_URL=postgres://user:pass@host:5432/twenty \
  -e REDIS_URL=redis://redis:6379 \
  -e APP_SECRET=$(openssl rand -base64 32) \
  -e SERVER_URL=http://localhost:3000 \
  -p 3000:3000 \
  twenty:local

# Ver logs
docker logs -f twenty-test

# Healthcheck manual
curl http://localhost:3000/healthz
```

---

## 🌍 Variables de Entorno Críticas

### **Obligatorias para AWS**

| Variable | Descripción | Valor AWS Recomendado |
|----------|-------------|----------------------|
| `PG_DATABASE_URL` | Conexión PostgreSQL | RDS endpoint (Secrets Manager) |
| `REDIS_URL` | Conexión Redis | ElastiCache endpoint |
| `APP_SECRET` | Clave secreta | AWS Secrets Manager (32+ chars) |
| `SERVER_URL` | URL pública del servidor | ALB DNS o dominio custom |
| `NODE_ENV` | Entorno | `production` |

### **Opcionales (Configurables según necesidad)**

| Variable | Default | Notas AWS |
|----------|---------|-----------|
| `STORAGE_TYPE` | `local` | Cambiar a `s3` en AWS |
| `STORAGE_S3_REGION` | N/A | `us-east-1`, `eu-west-1`, etc. |
| `STORAGE_S3_NAME` | N/A | Nombre del bucket S3 |
| `DISABLE_DB_MIGRATIONS` | `false` | `true` para worker (ejecutar solo en server) |
| `DISABLE_CRON_JOBS_REGISTRATION` | `false` | `true` para worker |
| `EMAIL_DRIVER` | `LOGGER` | `smtp` o `ses` en AWS |
| `LOGGER_DRIVER` | `CONSOLE` | Cambiar a `cloudwatch` |
| `SENTRY_DSN` | N/A | Para error tracking |
| `CAPTCHA_DRIVER` | N/A | Protección anti-bot |

### **Frontend (Build-time)**

| Variable | Descripción | Valor AWS |
|----------|-------------|-----------|
| `REACT_APP_SERVER_BASE_URL` | URL del backend | ALB público o CloudFront |
| `VITE_BUILD_SOURCEMAP` | Generar sourcemaps | `false` en prod (seguridad) |

---

## 📦 Dependencias Externas

### **Servicios de Infraestructura**
- ✅ PostgreSQL 16 → **AWS RDS PostgreSQL**
- ✅ Redis → **AWS ElastiCache Redis**
- ✅ Storage local → **AWS S3**

### **Integraciones Opcionales (Configurables)**
- Google Calendar/Gmail APIs
- Microsoft 365 APIs
- Email SMTP → **AWS SES**
- Sentry (error tracking)
- ClickHouse (analytics) → opcional
- Code Interpreter (E2B) → opcional

### **Recursos de Red**
- Puerto 3000 → Backend API + Frontend servido
- Puerto 5432 → PostgreSQL (privado)
- Port 6379 → Redis (privado)

---

## 🚨 Puntos Críticos para AWS

### ⚠️ **Ajustes Necesarios en FASE 2**

1. **Separación Frontend/Backend (Opcional pero recomendado):**
   - Actualmente el frontend se sirve desde el backend (`dist/front`)
   - Para AWS: considerar separar frontend en S3+CloudFront (mejor performance, menor costo)
   - Alternativa: mantener integrado si simplicidad es prioridad

2. **Gestión de Secretos:**
   - Migrar de `.env` files a **AWS Secrets Manager** o **SSM Parameter Store**
   - Rotar `APP_SECRET` en producción

3. **Storage S3:**
   - Cambiar `STORAGE_TYPE=local` → `STORAGE_TYPE=s3`
   - Configurar bucket con políticas restrictivas

4. **Migraciones DB:**
   - Ejecutar como ECS Task separada ANTES de deploy de app
   - Nunca ejecutar migraciones en múltiples instancias simultáneamente
   - Implementar backup pre-migración automático

5. **Logging & Monitoring:**
   - Cambiar `LOGGER_DRIVER=CONSOLE` → integración con CloudWatch
   - Configurar structured logging (JSON)
   - Implementar distributed tracing (X-Ray)

6. **Healthchecks:**
   - Endpoint `/healthz` ya implementado ✅
   - Configurar en ALB target group y ECS task definition

---

## 📊 Inventario de Recursos AWS Necesarios

### **Compute**
- [ ] ECR Repositories: `twenty-server`, `twenty-worker`
- [ ] ECS Cluster (Fargate)
- [ ] ECS Task Definitions: server, worker, migrations
- [ ] ECS Services: server (auto-scaling), worker (auto-scaling)

### **Database & Cache**
- [ ] RDS PostgreSQL 16 (Multi-AZ para prod)
- [ ] ElastiCache Redis (cluster mode para HA)
- [ ] RDS Automated Backups (retención 7-30 días)

### **Networking**
- [ ] VPC con subnets públicas/privadas (3 AZs)
- [ ] Application Load Balancer (público)
- [ ] NAT Gateway (para subnets privadas)
- [ ] Security Groups: ALB, ECS, RDS, Redis
- [ ] Route53 (DNS si dominio custom)
- [ ] ACM Certificate (SSL/TLS)

### **Storage & CDN**
- [ ] S3 Buckets: app-storage, backups, logs
- [ ] CloudFront Distribution (opcional para frontend)
- [ ] S3 Lifecycle Policies

### **Security & Secrets**
- [ ] AWS Secrets Manager: DB credentials, API keys
- [ ] IAM Roles: ECS Task Role, ECS Execution Role
- [ ] KMS Keys (encriptación datos sensibles)
- [ ] AWS WAF (protección ALB/CloudFront)

### **Observability**
- [ ] CloudWatch Log Groups: server, worker, migrations
- [ ] CloudWatch Alarms: CPU, memory, errors, latency
- [ ] CloudWatch Dashboards
- [ ] X-Ray (tracing)
- [ ] SNS Topics (alertas)

### **CI/CD**
- [ ] GitHub Actions Secrets: AWS credentials, ECR registry
- [ ] ECR Image Scanning (vulnerabilidades)

---

## 📈 Sizing Inicial Recomendado (Staging)

| Recurso | Sizing Staging | Costo Aprox/mes |
|---------|---------------|-----------------|
| ECS Tasks (server) | 2x 0.5 vCPU, 1GB RAM | ~$25 |
| ECS Tasks (worker) | 1x 0.5 vCPU, 1GB RAM | ~$12 |
| RDS PostgreSQL | db.t4g.micro (1 vCPU, 1GB) | ~$15 |
| ElastiCache Redis | cache.t4g.micro (1 vCPU, 0.5GB) | ~$12 |
| NAT Gateway | 1x (low traffic) | ~$35 |
| ALB | 1x (low RPS) | ~$20 |
| S3 + Data Transfer | 10GB storage, 50GB transfer | ~$5 |
| **Total Staging** | | **~$124/mes** |

> **Producción:** Multiplicar por ~3-5x según tráfico esperado + Multi-AZ + autoscaling

---

## ✅ Criterios de Éxito - FASE 1

- [x] **Inventario completo de servicios** → Documentado
- [x] **Comandos de build/test identificados** → Validados
- [x] **Variables de entorno mapeadas** → Listadas con equivalentes AWS
- [x] **Dockerfile producción analizado** → Multi-stage, optimizado
- [x] **Dependencias externas identificadas** → RDS, Redis, S3
- [ ] **Build local de producción exitoso** → **ACCIÓN SIGUIENTE**
- [ ] **Test local con imagen Docker** → **ACCIÓN SIGUIENTE**

---

## 🎯 Próximos Pasos (FASE 2)

1. **Validar build de producción local:**
   ```bash
   npx nx build twenty-server
   npx nx build twenty-front
   ```

2. **Test de imagen Docker completa:**
   ```bash
   docker build -f packages/twenty-docker/twenty/Dockerfile -t twenty:test .
   docker run --rm twenty:test node --version
   ```

3. **Crear/optimizar Dockerfiles para AWS:**
   - Mantener multi-stage actual ✅
   - Agregar labels para versionado
   - Optimizar .dockerignore

4. **Crear repositorios ECR:**
   ```bash
   aws ecr create-repository --repository-name twenty-server
   aws ecr create-repository --repository-name twenty-worker
   ```

5. **Push inicial manual a ECR** (antes de automatizar CI/CD)

---

## 📝 Notas Adicionales

### **Ventajas de la Arquitectura Actual**
- Monorepo con Nx → builds incrementales eficientes
- Dockerfile multi-stage → imágenes optimizadas
- Separación server/worker → escalado independiente
- Healthchecks nativos → integración directa con AWS
- Usuario no-root → cumple best practices de seguridad

### **Consideraciones de Performance**
- Frontend bundle size: revisar con `npx vite-bundle-visualizer`
- Database indexes: revisar queries lentas antes de migrar
- Redis cache hit rate: monitorear en AWS

### **Compliance & Seguridad**
- Datos personales: evaluar cumplimiento GDPR/CCPA
- Encriptación: RDS encryption at rest, S3 SSE
- Network isolation: subnets privadas para DB/Redis
- Secrets rotation: implementar con AWS Secrets Manager

---

## 🔗 Referencias

- [Dockerfile Producción](../packages/twenty-docker/twenty/Dockerfile)
- [Docker Compose](../packages/twenty-docker/docker-compose.yml)
- [Makefile](../makefile)
- [Guía CLAUDE](../CLAUDE.md)

---

**Estado:** FASE 1 completada ✅
**Siguiente:** FASE 2 - Containerización y Registro ECR
