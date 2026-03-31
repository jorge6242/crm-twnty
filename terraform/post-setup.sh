#!/bin/bash
# post-setup.sh — configuración post terraform apply
#
# Este script configura los settings que el provider Terraform de Railway
# no soporta. Correr UNA SOLA VEZ después de "terraform apply".
#
# Prerequisito: railway CLI instalado y logueado
#   railway login
#
# Uso:
#   chmod +x post-setup.sh
#   ./post-setup.sh <PROJECT_ID>
#
# El PROJECT_ID lo obtienes con:
#   terraform output project_id

set -e

PROJECT_ID=${1:?"ERROR: Debes pasar el PROJECT_ID como argumento. Ejemplo: ./post-setup.sh proj_xxxx"}

echo "==> Configurando proyecto: $PROJECT_ID"
echo ""

# ──────────────────────────────────────────────
# Redis — Start command
# ──────────────────────────────────────────────
echo "==> [Redis] Configurando start command..."
railway service update Redis \
  --start-command '/bin/sh -c "rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --maxmemory-policy noeviction --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH"' \
  --project "$PROJECT_ID"

echo ""
echo "==> Configuración automática completada."
echo ""
echo "──────────────────────────────────────────────"
echo "PASOS MANUALES RESTANTES (Railway Dashboard):"
echo "──────────────────────────────────────────────"
echo ""
echo "Postgres (Settings → Deploy):"
echo "  [ ] Restart Policy: On Failure"
echo "  [ ] Max restart retries: 10"
echo ""
echo "Postgres (Settings → Scale):"
echo "  [ ] Region: US West"
echo ""
echo "Postgres (botón Volume en el servicio):"
echo "  [ ] Crear volumen y montarlo"
echo ""
echo "Redis (Settings → Deploy):"
echo "  [ ] Restart Policy: On Failure"
echo "  [ ] Max restart retries: 10"
echo ""
echo "Redis (Settings → Scale):"
echo "  [ ] Region: US West"
echo ""
echo "Redis (botón Volume en el servicio):"
echo "  [ ] Crear volumen y montarlo"
echo ""
echo "──────────────────────────────────────────────"
echo "SECRETS (railway CLI, una sola vez):"
echo "──────────────────────────────────────────────"
echo ""
echo "  railway variables set APP_SECRET=\"...\"          --environment production"
echo "  railway variables set EMAIL_SMTP_PASSWORD=\"...\" --environment production"
echo "  railway variables set UNIPILE_API_KEY=\"...\"     --environment production"
echo "  railway variables set FULLENRICH_API_KEY=\"...\"  --environment production"
echo "  railway variables set GITHUB_PAT=\"...\"          --environment production"
echo ""
