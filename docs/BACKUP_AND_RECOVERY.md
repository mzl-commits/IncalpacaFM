# Backups y recuperación

El servicio `backup` de Docker crea cada 24 horas un respaldo consistente de PostgreSQL, archivos públicos y archivos privados. Cada ejecución crea una carpeta UTC con `postgres.dump`, `postgres-globals.sql`, los dos archivos comprimidos de medios, checksums y `restore-verification.txt`.

## Objetivos operativos

| Objetivo | Valor inicial | Control |
| --- | --- | --- |
| RPO | 24 horas | `BACKUP_INTERVAL_SECONDS=86400` |
| RTO | 4 horas | restauración mensual documentada |
| Retención local | 14 días | `BACKUP_RETENTION_DAYS=14` |
| Integridad | Obligatoria | `BACKUP_VERIFY_RESTORE=1` crea una DB temporal y restaura el dump |

El RPO/RTO debe revisarse con FM cuando se conozca el volumen real de archivos y la ventana de mantenimiento.

## Operación

1. Copia `.env.example` a `.env` y configura contraseñas seguras.
2. Inicia los servicios: `docker compose up -d --build`.
3. Ejecuta una prueba inmediata: `docker compose exec backup /usr/local/bin/incalpaca-backup`.
4. Comprueba que el último directorio de `backups/` contiene `restore-verification.txt` y `SHA256SUMS`.

El volumen de PostgreSQL no es un respaldo. No se elimina ni se recrea como parte de este procedimiento.

## Copia externa

El script soporta S3, SFTP, Azure Blob u otro destino compatible con rclone. Configure el remoto fuera del repositorio, en un gestor de secretos, y defina:

```env
BACKUP_EXTERNAL_TARGET=incalpaca-prod:backups/sgtb
BACKUP_RCLONE_CONFIG=/run/secrets/rclone.conf
```

Monte el `rclone.conf` como secreto de solo lectura en el contenedor `backup`. Nunca añada esa configuración ni credenciales a Git. Mientras `BACKUP_EXTERNAL_TARGET` esté vacío no se realizará transferencia externa.

## Restauración probada

Para un ejercicio controlado, detenga temporalmente las escrituras, seleccione un directorio de respaldo y restaure en una base nueva, no sobre producción:

```bash
docker compose exec -T postgres createdb -U "$POSTGRES_USER" incalpaca_restore_test
docker compose exec -T backup pg_restore --host=postgres --username="$POSTGRES_USER" --dbname=incalpaca_restore_test --no-owner --exit-on-error /backups/AAAAMMDDTHHMMSSZ/postgres.dump
docker compose exec -T backup tar -xzf /backups/AAAAMMDDTHHMMSSZ/media.tar.gz -C /tmp/media-restore
```

Valida recuentos críticos, una ficha de bien, una evidencia privada y el acceso de una cuenta. Documenta la duración y destruye únicamente la base de prueba al finalizar. El propio backup ya realiza esta restauración temporal en cada ejecución; el ejercicio mensual valida también personas, proceso y medios.

## Recuperación ante incidente

1. Declara el incidente y preserva el backup más reciente verificable.
2. Aísla la instancia afectada y restaura primero PostgreSQL.
3. Restaura `media.tar.gz` y `private-media.tar.gz` sobre volúmenes nuevos.
4. Ejecuta `/api/v1/health/ready/`, revisa los checksums y prueba flujos críticos.
5. Registra tiempos reales, datos potencialmente perdidos y acciones correctivas.
