#!/usr/bin/env bash
set -euo pipefail

interval="${BACKUP_INTERVAL_SECONDS:-86400}"
if ! [[ "$interval" =~ ^[0-9]+$ ]] || [ "$interval" -lt 300 ]; then
  echo "BACKUP_INTERVAL_SECONDS debe ser un entero de al menos 300 segundos." >&2
  exit 2
fi

while true; do
  /usr/local/bin/incalpaca-backup || echo "[$(date -Iseconds)] Backup falló; se reintentará en el siguiente ciclo." >&2
  sleep "$interval"
done
