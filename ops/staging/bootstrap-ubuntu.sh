#!/usr/bin/env bash
set -euo pipefail

# Ejecutar una sola vez como root en Ubuntu 22.04/24.04 antes del primer deploy.
APP_USER="${APP_USER:-incalpaca}"
DEPLOY_PATH="${DEPLOY_PATH:-/srv/incalpaca-staging}"

apt-get update
apt-get install -y ca-certificates curl docker.io docker-compose-plugin nginx certbot python3-certbot-nginx
systemctl enable --now docker nginx

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$APP_USER"
fi
usermod -aG docker "$APP_USER"

install -d -o "$APP_USER" -g "$APP_USER" -m 0750 \
  "$DEPLOY_PATH/releases" "$DEPLOY_PATH/shared" "$DEPLOY_PATH/backups"

echo "Servidor base preparado. Copie .env.staging.example a $DEPLOY_PATH/shared/.env,"
echo "reemplace todos los valores GENERAR_/CONFIGURAR_ y configure Nginx, DNS y Certbot."
