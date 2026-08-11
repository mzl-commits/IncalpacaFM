#!/usr/bin/env bash
set -euo pipefail

# Se instala en el host de staging y se ejecuta cada 5 minutos por cron/systemd.
# Requiere un .env con ALERT_WEBHOOK_URL, HEALTH_CHECK_TOKEN, NGINX_ACCESS_LOG y BACKUP_HOST_PATH.
ENV_FILE="${1:-/srv/incalpaca-staging/shared/.env}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-incalpaca-staging}"
COMPOSE_DIR="${COMPOSE_DIR:-/srv/incalpaca-staging/shared/current_release}"
API_URL="${API_URL:-https://api-staging-fm.example.pe}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-26}"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

alert() {
  local subject="$1" detail="$2"
  logger -t incalpaca-monitor "$subject: $detail"
  curl --silent --show-error --fail --max-time 10 \
    -H 'Content-Type: application/json' \
    --data "{\"text\":\"[SGTB staging] ${subject}: ${detail}\"}" \
    "$ALERT_WEBHOOK_URL" >/dev/null || true
}

compose() {
  docker compose -p "$COMPOSE_PROJECT" -f "$COMPOSE_DIR/compose.yaml" --env-file "$ENV_FILE" "$@"
}

if ! curl --silent --show-error --fail --max-time 10 "$API_URL/api/v1/health/live/" >/dev/null; then
  alert "HTTP no disponible" "El endpoint live no respondió correctamente"
fi
if ! curl --silent --show-error --fail --max-time 10 -H "X-Health-Token: $HEALTH_CHECK_TOKEN" "$API_URL/api/v1/health/ready/" >/dev/null; then
  alert "Dependencia degradada" "El endpoint ready reportó PostgreSQL, Redis o almacenamiento no disponible"
fi
if ! curl --silent --show-error --fail --max-time 10 -H "X-Health-Token: $HEALTH_CHECK_TOKEN" "$API_URL/api/v1/health/celery/" >/dev/null; then
  alert "Celery no disponible" "No hay worker respondiendo al health check"
fi

if ! compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null; then
  alert "PostgreSQL no disponible" "pg_isready falló dentro de la pila"
fi
if ! compose exec -T redis redis-cli ping | grep -qx PONG; then
  alert "Redis no disponible" "redis-cli ping falló dentro de la pila"
fi

disk_used="$(df -P "$BACKUP_HOST_PATH" | awk 'NR==2 {gsub(/%/, "", $5); print $5}')"
if [ "${disk_used:-0}" -ge "${HEALTH_DISK_WARNING_PERCENT:-80}" ]; then
  alert "Disco en umbral" "Uso actual ${disk_used}% en $BACKUP_HOST_PATH"
fi

latest_backup="$(find "$BACKUP_HOST_PATH" -mindepth 1 -maxdepth 1 -type d -printf '%T@\n' 2>/dev/null | sort -nr | head -n1 || true)"
if [ -z "$latest_backup" ] || [ "$(awk -v now="$(date +%s)" -v stamp="$latest_backup" -v max="$MAX_BACKUP_AGE_HOURS" 'BEGIN { print (now-stamp) > max*3600 }')" = "1" ]; then
  alert "Backup vencido" "No existe un respaldo verificable dentro de ${MAX_BACKUP_AGE_HOURS} horas"
fi

if [ -n "${NGINX_ACCESS_LOG:-}" ] && [ -r "$NGINX_ACCESS_LOG" ]; then
  errors_5xx="$(tail -n 2000 "$NGINX_ACCESS_LOG" | awk '$9 ~ /^5[0-9][0-9]$/ {count++} END {print count+0}')"
  if [ "$errors_5xx" -gt 0 ]; then
    alert "Errores HTTP 5xx" "Se detectaron ${errors_5xx} respuestas 5xx en las últimas 2000 líneas de Nginx"
  fi
fi
