#!/usr/bin/env python3
"""
INCALPACA FM - Script de Despliegue Automático para Red Privada
===============================================================
Este script empaqueta los cambios locales de la rama `main` en un paquete git bundle,
los transfiere de forma segura vía SFTP al servidor de producción en la red privada (172.18.10.24)
y desencadena la actualización automática del proyecto.

Uso:
    python scripts/deploy/deploy_main.py
"""

import os
import sys
import subprocess
import time

try:
    import paramiko
except ImportError:
    print("Instalando dependencia 'paramiko' para conexiones SSH/SFTP...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko"])
    import paramiko

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SERVER_IP = os.environ.get("SERVER_IP", "172.18.10.24")
SERVER_USER = os.environ.get("SERVER_USER", "soporte")
SERVER_PASS = os.environ.get("SERVER_PASS", r"Proyecto2026$% ")
SERVER_PASS = SERVER_PASS.strip()
REMOTE_BUNDLE_PATH = "/tmp/merged_main.bundle"

def run_local_cmd(cmd, cwd=None):
    result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    return result.returncode, result.stdout.strip(), result.stderr.strip()

def main():
    repo_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    bundle_local = os.path.join(repo_dir, "scripts", "deploy", "main.bundle")

    print("============================================================")
    print(" INCALPACA FM - AUTO-DESPLIEGUE RED PRIVADA (172.18.10.24)")
    print("============================================================")

    code, branch, _ = run_local_cmd("git branch --show-current", cwd=repo_dir)
    if branch != "main":
        print(f"⚠️  ADVERTENCIA: Estás en la rama '{branch}'. Cambiando a 'main'...")
        run_local_cmd("git checkout main", cwd=repo_dir)

    code, commit, _ = run_local_cmd("git log -1 --oneline", cwd=repo_dir)
    print(f"📦 Commit local actual a desplegar: {commit}")

    print("🔨 Creando paquete git bundle de la rama main...")
    if os.path.exists(bundle_local):
        try: os.remove(bundle_local)
        except Exception: pass

    code, out, err = run_local_cmd(f'git bundle create "{bundle_local}" main', cwd=repo_dir)
    if code != 0:
        print(f"❌ Error al crear el git bundle: {err}")
        sys.exit(1)

    print("✅ Paquete git bundle generado con éxito.")

    print(f"🚀 Conectando al servidor {SERVER_IP} ({SERVER_USER})...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(SERVER_IP, username=SERVER_USER, password=SERVER_PASS, timeout=15)
    except Exception as e:
        print(f"❌ No se pudo conectar al servidor SSH {SERVER_IP}: {e}")
        sys.exit(1)

    print(f"📤 Subiendo paquete de actualización a {REMOTE_BUNDLE_PATH}...")
    sftp = client.open_sftp()
    sftp.put(bundle_local, REMOTE_BUNDLE_PATH)
    sftp.close()
    print("✅ Transferencia SFTP completada con éxito.")

    try: os.remove(bundle_local)
    except Exception: pass

    print("\n============================================================")
    print(" 🔄 Ejecutando despliegue automatizado en el servidor...")
    print("============================================================")

    channel = client.get_transport().open_session()
    channel.get_pty()
    channel.exec_command("/usr/local/bin/incalpaca-sync-main")

    while True:
        if channel.recv_ready():
            data = channel.recv(4096).decode('utf-8', errors='ignore')
            print(data, end='', flush=True)
            if '[sudo] password for soporte:' in data:
                channel.send(f"{SERVER_PASS}\n")
        if channel.exit_status_ready():
            break
        time.sleep(0.5)

    while channel.recv_ready():
        data = channel.recv(4096).decode('utf-8', errors='ignore')
        print(data, end='', flush=True)

    exit_code = channel.recv_exit_status()
    client.close()

    print("\n============================================================")
    if exit_code == 0:
        print("🎉 DESPLIEGUE COMPLETADO SATISFACTORIAMENTE EN PRODUCCIÓN.")
        print("🌐 Aplicación disponible en: http://172.18.10.24:8080")
    else:
        print(f"❌ El proceso finalizó con código de error: {exit_code}")
    print("============================================================")

if __name__ == "__main__":
    main()
