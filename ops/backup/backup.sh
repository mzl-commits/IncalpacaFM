#!/usr/bin/env bash
set -euo pipefail
umask 077

root="${BACKUP_ROOT:-/backups}"
retention="${BACKUP_RETENTION_DAYS:-14}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$root/$timestamp"
database="${POSTGRES_DB:?POSTGRES_DB es obligatorio}"
db_user="${POSTGRES_USER:?POSTGRES_USER es obligatorio}"
db_host="${POSTGRES_HOST:-postgres}"
db_port="${POSTGRES_PORT:-5432}"

if ! [[ "$retention" =~ ^[0-9]+$ ]]; then
  echo "BACKUP_RETENTION_DAYS debe ser un entero." >&2
  exit 2
fi
mkdir -p "$root"
mkdir -p "$backup_dir"

export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD es obligatorio}"
echo "[$(date -Iseconds)] Iniciando backup $timestamp"
pg_dump --host="$db_host" --port="$db_port" --username="$db_user" --format=custom --file="$backup_dir/postgres.dump" "$database"
pg_dumpall --host="$db_host" --port="$db_port" --username="$db_user" --globals-only > "$backup_dir/postgres-globals.sql"
tar -C /source/media -czf "$backup_dir/media.tar.gz" .
tar -C /source/private -czf "$backup_dir/private-media.tar.gz" .

if [ "${BACKUP_VERIFY_RESTORE:-1}" = "1" ]; then
  verify_db="${database}_restore_check_${timestamp,,}"
  echo "[$(date -Iseconds)] Verificando restauración temporal: $verify_db"
  createdb --host="$db_host" --port="$db_port" --username="$db_user" "$verify_db"
  cleanup_verify() { dropdb --if-exists --host="$db_host" --port="$db_port" --username="$db_user" "$verify_db"; }
  trap cleanup_verify EXIT
  pg_restore --host="$db_host" --port="$db_port" --username="$db_user" --dbname="$verify_db" --no-owner --exit-on-error "$backup_dir/postgres.dump"
  psql --host="$db_host" --port="$db_port" --username="$db_user" --dbname="$verify_db" --tuples-only --no-align --command="SELECT 1" | grep -qx "1"
  cleanup_verify
  trap - EXIT
  printf 'verified_at=%s\n' "$(date -u -Iseconds)" > "$backup_dir/restore-verification.txt"
fi

(cd "$backup_dir" && sha256sum postgres.dump postgres-globals.sql media.tar.gz private-media.tar.gz restore-verification.txt 2>/dev/null || true) > "$backup_dir/SHA256SUMS"
cat > "$backup_dir/manifest.env" <<EOF
created_at=$(date -u -Iseconds)
database=$database
rpo_target_hours=${BACKUP_RPO_HOURS:-24}
restore_verified=${BACKUP_VERIFY_RESTORE:-1}
EOF

external_target="${BACKUP_EXTERNAL_TARGET:-}"
if [ -n "$external_target" ]; then
  config="${BACKUP_RCLONE_CONFIG:-/run/secrets/rclone.conf}"
  if [ ! -r "$config" ]; then
    echo "BACKUP_EXTERNAL_TARGET está configurado pero no existe un rclone.conf legible." >&2
    exit 3
  fi
  rclone --config "$config" copy "$backup_dir" "$external_target/$timestamp" --checksum --immutable
  printf 'external_copy_at=%s\nexternal_target=%s\n' "$(date -u -Iseconds)" "$external_target" >> "$backup_dir/manifest.env"
fi

# Sólo elimina carpetas con nombre de timestamp, dentro del volumen de respaldo.
find "$root" -mindepth 1 -maxdepth 1 -type d -name '20????????T??????Z' -mtime "+$retention" -exec rm -rf -- {} +
echo "[$(date -Iseconds)] Backup completado: $backup_dir"
