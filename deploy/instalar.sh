#!/usr/bin/env bash
# Instala (ou atualiza) o Projeto H num servidor Linux ou Mac — na nuvem ou no hotel.
# Uso:  bash deploy/instalar.sh
set -euo pipefail
cd "$(dirname "$0")"

command -v docker >/dev/null || { echo "Instale o Docker antes: https://docs.docker.com/engine/install/"; exit 1; }
docker compose version >/dev/null || { echo "Falta o 'docker compose' (plugin)."; exit 1; }

rand() { head -c 64 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }

if [ ! -f .env ]; then
  echo "=== Instalação do sistema do hotel ==="
  echo "Onde ele vai rodar?"
  echo "  1) Num computador do hotel (rede interna)"
  echo "  2) Na nuvem, com um domínio (ex.: sistema.meuhotel.com.br)"
  read -rp "Escolha 1 ou 2: " choice
  admin_pass="$(rand 14)"
  {
    echo "# Gerado por instalar.sh em $(date). NÃO compartilhe este arquivo."
    echo "POSTGRES_PASSWORD=$(rand 32)"
    echo "ADMIN_USERNAME=admin"
    echo "ADMIN_PASSWORD=$admin_pass"
  } > .env
  if [ "$choice" = "2" ]; then
    read -rp "Domínio (já apontando para este servidor): " domain
    read -rp "E-mail para avisos do certificado: " email
    { echo "MODE=cloud"; echo "DOMAIN=$domain"; echo "ACME_EMAIL=$email"; } >> .env
    url="https://$domain"
  else
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    [ -z "$ip" ] && ip="$(ipconfig getifaddr en0 2>/dev/null || true)"
    read -rp "Endereço deste computador na rede [$ip]: " typed
    ip="${typed:-$ip}"
    { echo "MODE=local"; echo "SERVER_ADDRESS=$ip"; } >> .env
    url="https://$ip"
  fi
  read -rp "Pasta para a cópia extra do backup (Google Drive, Dropbox, HD externo; vazio = deploy/backups-copia): " copia
  if [ -n "$copia" ]; then mkdir -p "$copia"; echo "BACKUP_COPY_DIR=$copia" >> .env; fi
  chmod 600 .env
  mkdir -p backups
  echo
  echo "==============================================================="
  echo " Usuário: admin"
  echo " Senha:   $admin_pass"
  echo " Anote agora e troque no primeiro acesso (Meu perfil)."
  echo "==============================================================="
else
  echo "Já instalado: atualizando..."
  # shellcheck disable=SC1091
  . ./.env
  if [ "${MODE:-local}" = "cloud" ]; then url="https://$DOMAIN"; else url="https://$SERVER_ADDRESS"; fi
fi

docker compose up -d --build
echo
echo "Pronto! Aguarde ~1 minuto e abra: $url"
if grep -q '^MODE=local' .env; then
  echo "Em cada aparelho, instale uma vez o certificado: http://${url#https://}/certificado.crt"
  echo "(passo a passo em docs/INSTALACAO.md)"
fi
