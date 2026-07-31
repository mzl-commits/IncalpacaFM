# PostgreSQL local

La aplicación acepta PostgreSQL mediante variables de entorno y conserva SQLite
únicamente como respaldo cuando no existe configuración de base de datos.

## Preparar el entorno

Desde la raíz del repositorio, en PowerShell:

```powershell
Copy-Item .env.example .env
```

Cambie `POSTGRES_PASSWORD` y `DJANGO_SECRET_KEY` en `.env`. El archivo `.env`
está ignorado por Git y no debe versionarse.

Inicie PostgreSQL y espere a que el chequeo de salud sea satisfactorio:

```powershell
docker compose up -d postgres
docker compose ps
```

## Crear el esquema y cargar datos de demostración

```powershell
backend\.venv\Scripts\python.exe backend\manage.py migrate
backend\.venv\Scripts\python.exe backend\manage.py seed_demo_data
```

Compruebe que Django está usando PostgreSQL:

```powershell
backend\.venv\Scripts\python.exe backend\manage.py shell -c "from django.db import connection; print(connection.vendor)"
```

El resultado esperado es `postgresql`. Las migraciones son las mismas de Django;
no se debe crear una migración de modelos solo por cambiar el motor.

## Migrar los datos existentes de SQLite

No use `pgloader`, `dumpdata` global ni una copia tabla por tabla. Esos métodos
pueden trasladar identificadores internos de `django_migrations`,
`django_content_type`, permisos, sesiones o tokens y dejar las relaciones en un
estado incoherente. El comando del proyecto genera un bundle portable con
usuarios, grupos y modelos de negocio; PostgreSQL crea por sí mismo las tablas
internas mediante las migraciones.

1. Conserve `backend/db.sqlite3` sin modificar y seleccione SQLite temporalmente
   en `.env`:

   ```dotenv
   DB_ENGINE=sqlite
   SQLITE_PATH=backend/db.sqlite3
   ```

   Las rutas SQLite relativas se resuelven desde la raíz del repositorio, sin
   depender de la carpeta desde la que se ejecute `manage.py`.

2. Compruebe el esquema y exporte a un archivo nuevo. `backups/` está ignorado
   por Git y el comando nunca sobrescribe un bundle existente:

   ```powershell
   backend\.venv\Scripts\python.exe backend\manage.py migrate --check
   backend\.venv\Scripts\python.exe backend\manage.py migrate_to_postgres export --output backups\sqlite-portable.json
   backend\.venv\Scripts\python.exe backend\manage.py migrate_to_postgres validate --input backups\sqlite-portable.json
   ```

3. Configure PostgreSQL nuevamente en `.env`, inicie el servicio y cree el
   esquema. Para esta transición **no ejecute** `seed_demo_data`:

   ```powershell
   docker compose up -d postgres
   backend\.venv\Scripts\python.exe backend\manage.py migrate
   ```

4. Importe y verifique. Las migraciones crean una taxonomía inicial y el usuario
   técnico vacío `facility.demo` aun en una base nueva; el flag siguiente autoriza
   reemplazar solo esos datos bootstrap si están intactos y no tienen dependencias:

   ```powershell
   backend\.venv\Scripts\python.exe backend\manage.py migrate_to_postgres import --input backups\sqlite-portable.json --replace-bootstrap-taxonomy
   backend\.venv\Scripts\python.exe backend\manage.py migrate_to_postgres verify --input backups\sqlite-portable.json
   ```

   La verificación anterior es estricta y debe ejecutarse inmediatamente después de
   importar. Si la aplicación ya fue utilizada, un inicio de sesión puede cambiar
   `AccountProfile.last_access` sin alterar los datos de negocio. En ese caso puede
   repetirse una verificación semántica que sigue comparando todos los conteos y campos
   salvo ese metadato operativo:

   ```powershell
   backend\.venv\Scripts\python.exe backend\manage.py migrate_to_postgres verify --input backups\sqlite-portable.json --allow-runtime-metadata
   ```

El importador se ejecuta en una transacción, comprueba las claves foráneas,
restablece secuencias y compara conteos y una huella SHA-256 de todos los datos.
Si encuentra migraciones distintas, datos de aplicación preexistentes, una
taxonomía bootstrap alterada o cualquier diferencia final, revierte la operación
completa. La base SQLite original no se elimina y permite volver atrás cambiando
`DB_ENGINE=sqlite`.

El bundle no incluye sesiones, tokens JWT revocados, registros del administrador,
`django_migrations`, content types ni filas de permisos. Los permisos se regeneran
con `migrate` y las relaciones de usuarios y grupos usan sus claves naturales. Los
usuarios deberán iniciar sesión otra vez. El bundle sí contiene hashes de
contraseñas y datos operativos: trátelo como un respaldo confidencial, no lo suba
a Git y elimínelo de forma segura cuando la transición haya sido aceptada.

## Usar una instancia administrada

Defina `DATABASE_URL` con la URL entregada por el proveedor. Esa variable tiene
precedencia sobre `DB_ENGINE` y los valores `POSTGRES_*`. En producción use el
modo SSL requerido por el proveedor mediante `POSTGRES_SSLMODE` o como parámetro
de la URL.

## Volver temporalmente a SQLite

Para una prueba aislada sin PostgreSQL, use `DB_ENGINE=sqlite`. Esta opción no
migra ni sincroniza datos entre motores.
