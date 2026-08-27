# Script ejecutable PowerShell para desplegar cambios a producción (172.18.10.24)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
python "$ScriptDir\deploy_main.py"
