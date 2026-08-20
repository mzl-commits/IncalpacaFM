@echo off
REM =============================================================
REM  INCALPACA FM - Script de despliegue (Windows)
REM  Ejecutar UNA SOLA VEZ al configurar el servidor.
REM  Es seguro correrlo varias veces (idempotente).
REM =============================================================

SET APP_DIR=%~dp0
SET EXCEL=%APP_DIR%importacion\Plantilla_importacion_materiales.xlsx
SET FOTOS_DIR=%APP_DIR%importacion\fotos
SET MAX_POR_DIA=5

REM Activar entorno virtual si existe
IF EXIST "%APP_DIR%..\venv\Scripts\activate.bat" (
    CALL "%APP_DIR%..\venv\Scripts\activate.bat"
    echo [OK] Entorno virtual activado.
) ELSE (
    echo [WARN] Sin entorno virtual - usando Python del sistema.
)

echo.
echo ============================================================
echo   INCALPACA FM - DEPLOY A PRODUCCION
echo ============================================================

echo.
echo [1/2] Aplicando migraciones...
python manage.py migrate --noinput
IF ERRORLEVEL 1 goto :error

echo.
echo [2/2] Ejecutando bootstrap de datos...

IF EXIST "%FOTOS_DIR%" (
    python manage.py deploy_bootstrap --excel "%EXCEL%" --max-por-dia %MAX_POR_DIA% --fotos-dir "%FOTOS_DIR%"
) ELSE (
    python manage.py deploy_bootstrap --excel "%EXCEL%" --max-por-dia %MAX_POR_DIA%
)
IF ERRORLEVEL 1 goto :error

echo.
echo ============================================================
echo   DEPLOY COMPLETADO EXITOSAMENTE
echo ============================================================
echo.
echo Proximos pasos:
echo   1. Crear superusuario : python manage.py createsuperuser
echo   2. Levantar servidor  : python manage.py runserver
echo.
goto :end

:error
echo.
echo [ERROR] El deploy fallo. Revisa el log arriba.
exit /b 1

:end