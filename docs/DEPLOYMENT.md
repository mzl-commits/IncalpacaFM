# Arranque y despliegue

Esta guía deja el repositorio operativo después de un `git pull`. La aplicación
usa PostgreSQL, Redis, Django/Gunicorn y Celery mediante Docker Compose. El
frontend se compila con Vite y debe publicarse detrás del mismo dominio HTTPS
que usa el enlace QR.

## Requisitos

- Docker Engine y Docker Compose v2.
- Node.js 22 LTS y npm para compilar el frontend.
- Un archivo `.env` creado a partir de `.env.example`.
- En producción: DNS, proxy inverso/TLS y un destino externo para respaldos.

No se versionan `.env`, medios privados, respaldos ni planillas de trabajo.

## Primer arranque local

En PowerShell, desde la raíz del repositorio:

```powershell
Copy-Item .env.example .env
# Edite .env y defina al menos POSTGRES_PASSWORD y DJANGO_SECRET_KEY.
docker compose up -d --build
docker compose ps
Invoke-WebRequest http://127.0.0.1:8000/api/v1/health/live/

Set-Location frontend
npm ci
npm run dev
```

El contenedor `migrate` aplica las migraciones antes de iniciar API, worker y
scheduler. Para cargar solo datos de demostración en una base nueva:

```powershell
Set-Location ..
docker compose exec -T backend python manage.py seed_demo_data
```

No ejecute el seeder sobre una base que ya contiene datos operativos.

## Actualización con Git

```powershell
git pull origin main
docker compose up -d --build
docker compose exec -T backend python manage.py check
docker compose exec -T backend python manage.py migrate --check
Set-Location frontend
npm ci
npm run build
```

El `up --build` vuelve a ejecutar el servicio `migrate`. Si una migración falla,
no se inician API, Celery worker ni scheduler: revise `docker compose logs
migrate` y corrija antes de continuar.

## Producción

Use valores diferentes a desarrollo y no copie secretos al repositorio:

```dotenv
DJANGO_ENV=production
DJANGO_DEBUG=0
DJANGO_SECRET_KEY=<secreto aleatorio de 50 o más caracteres>
DJANGO_ALLOWED_HOSTS=sgtb.ejemplo.pe
CSRF_TRUSTED_ORIGINS=https://sgtb.ejemplo.pe
CORS_ALLOWED_ORIGINS=https://sgtb.ejemplo.pe
PUBLIC_FRONTEND_URL=https://sgtb.ejemplo.pe
SECURE_SSL_REDIRECT=1
SECURE_HSTS_SECONDS=31536000
POSTGRES_PASSWORD=<secreto>
BREVO_SMTP_USERNAME=<usuario SMTP>
BREVO_SMTP_PASSWORD=<clave SMTP>
NOTIFICATION_DISPATCH_ENABLED=1
HEALTH_CHECK_TOKEN=<token largo de monitoreo>
BACKUP_EXTERNAL_TARGET=<remoto-rclone:bucket/ruta>
```

Compile `frontend` con `npm ci` y `npm run build`, publique `frontend/dist` con
un servidor estático y dirija `/api/` al puerto 8000 de Gunicorn. El proxy debe
terminar TLS, redirigir HTTP a HTTPS y enviar `X-Forwarded-Proto: https`.
Mantenga PostgreSQL y Redis sin puertos públicos; el Compose ya los deja solo
en la red local.

Configure las sondas `/api/v1/health/live/`, `/api/v1/health/ready/` y
`/api/v1/health/celery/`. Las dos últimas requieren la cabecera
`X-Health-Token` con el valor configurado. Consulte también
`docs/PRODUCTION_SECURITY.md`, `docs/BACKUP_AND_RECOVERY.md` y
`docs/STAGING.md` antes de publicar.

## Verificación mínima

```powershell
docker compose exec -T backend python manage.py check
docker compose exec -T backend python manage.py test apps.incidents.tests apps.workorders --keepdb
Set-Location frontend
npm run lint
npm run build
```

Para detener el entorno conservando datos: `docker compose down`. No use
`docker compose down -v` en un entorno que contenga información que deba
conservarse.
