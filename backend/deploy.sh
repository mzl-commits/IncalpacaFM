#!/usr/bin/env bash
# =============================================================
#  INCALPACA FM - Script de despliegue a produccion
#  Ejecutar UNA SOLA VEZ al montar la maquina/VM.
#  Es seguro correrlo varias veces (idempotente).
# =============================================================
set -Eeuo pipefail

APP_DIR="$(dirname "$(readlink -f "$0")")"

PYTHON="${PYTHON:-python3}"
VENV_DIR="${VENV_DIR:-$APP_DIR/../venv}"
EXCEL="${EXCEL:-$APP_DIR/importacion/Plantilla_importacion_materiales.xlsx}"
FOTOS_DIR="${FOTOS_DIR:-$APP_DIR/importacion/fotos}"
MAX_POR_DIA="${MAX_POR_DIA:-5}"

if [ -f "$VENV_DIR/bin/activate" ]; then
    source "$VENV_DIR/bin/activate"
    echo "[OK] Entorno virtual activado."
else
    echo "[WARN] Sin entorno virtual en $VENV_DIR - usando Python del sistema."
fi

cd "$APP_DIR"

echo ""
echo "============================================================"
echo "  INCALPACA FM - DEPLOY A PRODUCCION"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

echo ""
echo "[1/2] Aplicando migraciones..."
$PYTHON manage.py migrate --noinput

echo ""
echo "[2/2] Ejecutando bootstrap de datos..."

FOTOS_ARG=""
if [ -d "$FOTOS_DIR" ]; then
    FOTOS_ARG="--fotos-dir $FOTOS_DIR"
fi

$PYTHON manage.py deploy_bootstrap \
    --excel "$EXCEL" \
    --max-por-dia "$MAX_POR_DIA" \
    $FOTOS_ARG

echo ""
echo "============================================================"
echo "  DEPLOY COMPLETADO: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""
echo "Proximos pasos:"
echo "  1. Crear superusuario : python manage.py createsuperuser"
echo "  2. Levantar servidor  : gunicorn config.wsgi:application"
echo "  3. Verificar admin    : http://tu-servidor/admin/"