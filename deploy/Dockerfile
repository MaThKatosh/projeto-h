# Imagem do sistema para o servidor (PC do hotel ou nuvem).
# Construída por deploy/docker-compose.yml — não precisa rodar à mão.

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Dependências primeiro (cache: só reinstala quando o package-lock muda).
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=America/Sao_Paulo
RUN apt-get update && apt-get install -y --no-install-recommends tzdata curl && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app /app
# (o arquivo pode ter vindo do Windows com quebra de linha CRLF)
RUN sed -i 's/\r$//' deploy/entrypoint.sh && chmod +x deploy/entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/saude || exit 1
ENTRYPOINT ["deploy/entrypoint.sh"]
