#!/usr/bin/env bash
# Script ejecutable Bash para desplegar cambios a producción (172.18.10.24)
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
python3 "$DIR/deploy_main.py"
