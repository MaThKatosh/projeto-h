#!/usr/bin/env bash
# Volta o banco para uma cópia de segurança. APAGA os dados atuais.
# Uso:  bash deploy/restaurar-backup.sh deploy/backups/hotel-2026-12-01_0300.dump
set -euo pipefail
cd "$(dirname "$0")"
file="${1:?informe o arquivo .dump (veja a pasta deploy/backups)}"
[ -f "$file" ] || [ -f "../$file" ] || { echo "Arquivo não encontrado: $file"; exit 1; }
name="$(basename "$file")"
read -rp "Isso SUBSTITUI todos os dados atuais pela cópia $name. Digite RESTAURAR para continuar: " ok
[ "$ok" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }
docker compose stop app
docker compose exec -T db sh -c 'pg_restore -U hotel -d hotel --clean --if-exists --no-owner' < "backups/$name"
docker compose start app
echo "Restaurado a partir de $name."
