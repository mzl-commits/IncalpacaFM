# Staging separado

Staging usa dominio QR, base de datos, secretos, correo y almacenamiento distintos a producción. Copia `.env.staging.example` fuera del repositorio y reemplaza todos sus valores.

- `PUBLIC_QR_BASE_URL` debe usar el dominio QR de staging, nunca el productivo.
- Carga únicamente seeders anonimizados: no restaurar respaldos productivos.
- GitHub Environment `staging` despliega desde `develop`.
- GitHub Environment `production` despliega únicamente desde `main` y debe exigir revisores en Settings → Environments.

La aprobación manual se aplica por GitHub Environment; no se almacena ninguna credencial en el workflow.
