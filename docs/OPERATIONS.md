# Operación, monitoreo y calidad

## Sondas de salud

| Ruta | Uso | Acceso |
| --- | --- | --- |
| `/api/v1/health/live/` | Confirma que Django responde. | Pública, sin detalles. |
| `/api/v1/health/ready/` | Confirma PostgreSQL, Redis y almacenamiento. | Administrador o cabecera `X-Health-Token`. |
| `/api/v1/health/celery/` | Confirma al menos un worker Celery disponible. | Administrador o cabecera `X-Health-Token`. |

En producción configure `HEALTH_CHECK_TOKEN` con un valor aleatorio largo. El proxy o monitor debe enviar dicho valor mediante la cabecera `X-Health-Token`. No exponga las rutas `ready` ni `celery` a Internet sin esta protección.

Celery Beat ejecuta cada 15 minutos verificaciones de PostgreSQL, Redis, Celery, uso del disco y, si se define `MONITORING_TLS_HOST`, vencimiento del certificado. Las incidencias crean avisos para los administradores mediante el outbox existente, por lo que un error de correo no borra la alerta.

## Reglas de GitHub

Configure protección en `develop` y `main` para exigir la workflow **Quality gate**, revisión de Pull Request y conversaciones resueltas. `main` debe requerir aprobación manual de despliegue y un backup previo.

La workflow valida calidad Python y TypeScript, migraciones, pruebas, esquema OpenAPI, dependencias, secretos y un smoke test con Docker. El esquema OpenAPI se publica como artefacto de cada ejecución para revisar cambios de contrato.
