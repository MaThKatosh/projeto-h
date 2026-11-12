#!/bin/sh
# Ao ligar: atualiza o banco (migrações), garante o administrador e sobe o sistema.
set -e
echo "[hotel] atualizando o banco de dados..."
npx prisma migrate deploy
echo "[hotel] conferindo o administrador..."
npx tsx prisma/seed.ts
echo "[hotel] sistema no ar."
exec npx next start --hostname 0.0.0.0 --port 3000
