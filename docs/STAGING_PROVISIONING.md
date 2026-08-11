# Provisionamiento de staging

Este procedimiento crea un ambiente aislado. No copie una base, medios ni
secretos de producción.

## 1. Infraestructura y DNS

1. Solicite una VM Ubuntu 22.04/24.04 con mínimo 4 vCPU, 8 GB RAM y 80 GB SSD.
2. Reserve subdominios distintos: `staging-fm.<dominio>` para la aplicación y
   `api-staging-fm.<dominio>` para la API/health checks.
3. Cree registros A/AAAA hacia la IP de staging y restrinja SSH al equipo de
   integración. Abra solo 80/443 públicamente; PostgreSQL y Redis permanecen
   internos.
4. Ejecute `ops/staging/bootstrap-ubuntu.sh` como root, creando un usuario SSH
   de despliegue sin acceso a secretos productivos.

## 2. Secretos y despliegue

1. Copie `.env.staging.example` a `/srv/incalpaca-staging/shared/.env` y
   reemplace cada valor `GENERAR_` o `CONFIGURAR_` usando un gestor de secretos.
2. Configure Certbot/Nginx para ambos subdominios antes del primer deploy.
3. En GitHub > Environments > `staging`, configure secretos `DEPLOY_HOST`,
   `DEPLOY_USER`, `DEPLOY_SSH_KEY`; variables `DEPLOY_PATH`,
   `STAGING_QR_DOMAIN` y `PUBLIC_API_URL`.
4. Despliegue desde `develop` o ejecute manualmente la workflow **Deploy
   controlled** con destino `staging`.

## 3. Alertas operativas

El backend ya genera notificaciones cada 15 minutos para PostgreSQL, Redis,
Celery, disco y TLS. Instale además el monitor externo para detectar 5xx y la
antigüedad real de backups:

```bash
sudo install -m 0644 ops/monitor/incalpaca-operational-monitor.service /etc/systemd/system/
sudo install -m 0644 ops/monitor/incalpaca-operational-monitor.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now incalpaca-operational-monitor.timer
sudo systemctl start incalpaca-operational-monitor.service
```

Verifique `systemctl list-timers incalpaca-operational-monitor.timer` y pruebe
un evento controlado. El webhook de alertas debe pertenecer a un canal del equipo
de operación, no a una cuenta personal.

## 4. Cierre de UAT

Ejecute [UAT_ACEPTACION_STAGING.md](UAT_ACEPTACION_STAGING.md), adjunte enlaces
a capturas/archivos y obtenga las seis conformidades. Solo después de no tener
hallazgos críticos o altos se puede autorizar un piloto limitado.
