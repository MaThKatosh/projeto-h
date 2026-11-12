# Projeto H — Sistema do Hotel

Sistema hoteleiro visual e interligado: recepção, governança, manutenção,
reservas, restaurante, frigobar, financeiro e auditoria num só lugar.

**Tecnologias:** Next.js 16 · React 19 · Prisma 7 · PostgreSQL 17 (Docker) · Tailwind 4.

## Instalar no hotel (uso de verdade)

Um comando instala tudo (sistema, banco, HTTPS e backup diário), num computador do
hotel ou na nuvem — passo a passo em **[docs/INSTALACAO.md](docs/INSTALACAO.md)**:

```
powershell -ExecutionPolicy Bypass -File deployinstalar.ps1   # Windows
bash deploy/instalar.sh                                     # Linux / Mac
```

## Como rodar para desenvolver (primeira vez)

```bash
npm install
cp .env.example .env        # preencha as senhas
npm run db:up               # sobe o banco (container hotel-db, porta 5433)
npm run db:deploy           # cria as tabelas
npm run db:seed             # cria o admin e um hotel de exemplo
npm run dev                 # http://localhost:3000
```

Entre com o usuário `admin` e a senha que está em `SEED_ADMIN_PASSWORD` no `.env`.

### Usar em outros aparelhos do hotel

O servidor aceita conexões da rede local. Descubra o IP do computador
(`ipconfig`) e, nos outros aparelhos, abra `http://IP-DO-COMPUTADOR:3000`.
Em desenvolvimento, coloque esse IP em `ALLOWED_DEV_ORIGINS` no `.env`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Sistema em modo desenvolvimento |
| `npm test` | Testes automáticos |
| `npm run typecheck` / `npm run lint` | Verificações de código |
| `npm run db:migrate` | Cria uma migration nova após mudar o `schema.prisma` |
| `npm run db:studio` | Abre o banco num navegador para inspecionar |

## Organização

```
app/entrar          tela de login
app/(sistema)       telas internas (menu lateral)
  mapa/             mapa de quartos ao vivo
  governanca/       painel da governança (arrumação)
  manutencao/       painel da manutenção (ocorrências)
  recepcao/         chegadas e saídas do dia
  reservas/         mapa de reservas, lista, nova reserva, detalhe
  garagem/          veículos na casa
  tarifas/          tarifas, ISS e estacionamento
  financeiro/       borderô do dia e contas abertas
  restaurante/      salão (mesas) e comandas
  cozinha/          pedidos para preparar
  frigobar/         lançar consumo e lista de reposição
  cardapio/         itens, mesas e taxa de serviço
  auditoria/        auditoria noturna
  relatorios/       relatórios (tela, impressão e CSV)
  quartos/          cadastro de tipos e quartos
  usuarios/         usuários e cargos
  perfil/           trocar a própria senha e o idioma
  configuracoes/    dados do hotel, pagamentos, bandeiras, channel manager
  reservas/importar importar reservas dos portais (CSV)
  reservas/[id]/fnrh ficha FNRH para imprimir
app/api/eventos     canal de avisos em tempo real
app/api/integracoes API do channel manager (reservas e vagas)
app/api/saude       verificação de saúde (instalação)
app/manifest.ts     app instalável (com public/sw.js e public/offline.html)
lib/integrations/   leitura dos arquivos dos portais e gravação das reservas de fora
lib/guests/fnrh.ts  campos e listas da FNRH
lib/i18n/           idiomas (PT/EN/ES): tr("texto"), tabelas em messages/
deploy/             instalação: Docker, Caddy (HTTPS), backup, instaladores
apps/               apps nativos: conectar/ (tela inicial), desktop/ (Tauri), mobile/ (Capacitor)
.github/workflows/  montagem dos instaladores dos apps na nuvem do GitHub
lib/permissions.ts  cargos, hierarquia e o que cada um pode fazer
lib/rooms/          cores do mapa, regras de mudança, serviço de quartos
lib/housekeeping/   tarefas de limpeza
lib/maintenance/    ocorrências e cálculo da manutenção do quarto
lib/reservations/   reservas, disponibilidade, check-in/out, troca, garagem
lib/rates/          tarifas
lib/folio/          conta do quarto: lançamentos, diárias, estornos
lib/restaurant/     comandas, cozinha, cardápio
lib/minibar/        frigobar
lib/night-audit/    auditoria noturna
lib/reports/        motor e catálogo de relatórios
lib/hotel-date.ts   data do sistema (data hoteleira)
lib/realtime.ts     avisos em tempo real (PostgreSQL LISTEN/NOTIFY)
docs/               uma página por fase
```

## Fases

- [x] **Fase 1** — base, login, cargos, cadastro de quartos, mapa ao vivo ([docs/FASE-1.md](docs/FASE-1.md))
- [x] **Fase 2** — governança e manutenção: tarefas de limpeza, ocorrências, tudo ligado ao mapa ([docs/FASE-2.md](docs/FASE-2.md))
- [x] **Fase 3** — reservas, tarifas com ISS, recepção, check-in/out, troca de quarto, garagem ([docs/FASE-3.md](docs/FASE-3.md))
- [x] **Fase 4** — conta do quarto, pagamentos, estornos, check-out com conta zerada, borderô ([docs/FASE-4.md](docs/FASE-4.md))
- [x] **Fase 5** — restaurante (salão, comandas, cozinha), frigobar e cardápio, lançando na conta do quarto ([docs/FASE-5.md](docs/FASE-5.md))
- [x] **Fase 6** — auditoria noturna (lança diárias, guarda os números do dia, vira a data) e 17 relatórios com impressão e Excel ([docs/FASE-6.md](docs/FASE-6.md))
- [x] **Extra** — tela de Configurações, bandeiras de cartão, botões de desfazer (auditoria, check-in, check-out, cancelamento) e idiomas PT/EN/ES ([docs/CONFIGURACOES.md](docs/CONFIGURACOES.md))
- [x] **Fase 7** — instalação com HTTPS (PC do hotel ou nuvem) e backup diário, app instalável + apps nativos, importação de reservas dos portais e API para channel manager, ficha FNRH ([docs/FASE-7.md](docs/FASE-7.md))
