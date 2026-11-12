# Fase 7 — Instalação, apps, portais e ficha do hóspede

Concluída em 12/11/2026.

## Ficha do hóspede (FNRH)

- O cadastro do hóspede ganhou os campos da Ficha Nacional de Registro de Hóspedes:
  sexo, profissão, órgão emissor do documento, endereço, CEP e país.
- No **check-in** (e na entrada direta) há o bloco **Viagem**: motivo, meio de
  transporte, de onde vem e para onde vai. Dá para corrigir depois em *editar* hóspede.
- Na reserva: botão **🖨 Ficha FNRH** — uma página por pessoa (titular e
  acompanhantes), pronta para imprimir e o hóspede assinar. Aviso
  "Ficha incompleta: …" quando falta algo importante.
- Relatório **Fichas de hóspedes (FNRH)**: uma linha por pessoa que entrou no período,
  com todos os campos, e coluna "Falta preencher". Sai em Excel.

## Reservas dos portais

### Por arquivo (`Reservas → ⇪ Importar do portal`)
1. Baixe a lista no extranet do portal (Booking.com, Expedia / Hoteis.com...) em CSV.
   Também aceita o **modelo** do sistema (link na tela), para agência ou outro portal.
2. Escolha o portal e envie o arquivo. O sistema entende os nomes de coluna em
   português e inglês, datas em vários formatos e valores como "900 BRL" ou "R$ 1.234,56".
3. Ligue os **tipos de quarto do portal** aos do hotel (ele sugere quando é claro; a
   escolha fica lembrada para a próxima vez).
4. Confira a prévia — cada linha diz o que vai acontecer:
   **Nova**, **Alterar** (datas/valor mudaram no portal), **Cancelar** (cancelada no
   portal), **Ignorar** (já importada, cancelada sem nunca ter entrado, já hospedado...)
   ou **Problema** (sem vaga, sem tipo, data passada...).
5. **Importar**. Cada reserva entra com origem do portal e o código dele; o histórico
   registra "Importada de Booking.com (código ...)".

Importar o mesmo arquivo de novo **não duplica** (o banco garante: um código por portal).
Diária = total do portal ÷ noites. Café incluso e ISS são escolhidos na tela.

### Automático (channel manager)
Em *Configurações → 🌐 Portais e channel manager*: **Ligar integração** gera uma chave
(mostrada uma vez). Passe ao channel manager contratado:

- `POST /api/integracoes/reservas` — cria/altera/cancela uma reserva
- `GET /api/integracoes/disponibilidade?de=AAAA-MM-DD&ate=AAAA-MM-DD` — vagas por tipo e noite

Cabeçalho: `Authorization: Bearer <chave>`. Corpo do POST (JSON):

```json
{
  "source": "BOOKING",
  "externalCode": "4455667788",
  "status": "confirmed",
  "guest": { "fullName": "Ana Lima", "email": "ana@exemplo.com", "phone": "+55 11 98888-0000", "country": "Brasil" },
  "checkIn": "2026-12-20",
  "checkOut": "2026-12-23",
  "roomType": "Standard Casal",
  "adults": 2,
  "children": 0,
  "totalCents": 90000,
  "breakfast": true,
  "chargeIss": false,
  "notes": "Chega tarde"
}
```

`status`: `confirmed`, `modified` ou `cancelled`. `source`: BOOKING, HOTEIS_COM, EXPEDIA,
DECOLAR, AIRBNB, AGENCIA, SITE ou OUTRO. `roomType`: nome (ou id) do tipo do hotel.
Resposta: `{ "ok": true, "action": "criar" | "alterar" | "cancelar" | "ignorar", "number": 19 }`
(erros: 400 dados inválidos, 401 chave errada, 409 sem vaga etc., com `error`).
As reservas aparecem como criadas por "Integração (channel manager)" — um usuário
técnico que não entra no sistema. *Gerar chave nova* invalida a anterior na hora;
*Desligar* corta a integração.

## Instalação com HTTPS

Passo a passo para o dono do hotel em **[INSTALACAO.md](INSTALACAO.md)**. Resumo técnico:

- `deploy/docker-compose.yml`: `app` (imagem de `deploy/Dockerfile`), `db` (PostgreSQL,
  sem porta exposta), `caddy` (HTTPS) e `backup` (pg_dump diário, 30 dias, em `deploy/backups`).
- `deploy/instalar.ps1` / `instalar.sh`: perguntam **PC do hotel** ou **nuvem**, geram
  `deploy/.env` com senhas aleatórias e sobem tudo; rodar de novo = atualizar.
- Ao ligar, o app aplica as migrações, garante o admin (sem hotel de exemplo:
  `SEED_EXAMPLE=0`) e sobe. Cookie de sessão `__Host-` só em HTTPS.
- PC do hotel: Caddy com certificado próprio (`tls internal`); o certificado raiz é
  servido em `http://SERVIDOR/certificado.crt` para instalar nos aparelhos.
- Nuvem: Caddy com Let's Encrypt para o domínio.
- `GET /api/saude` responde se o sistema e o banco estão ok (sem dados do hotel).

Testado aqui: imagem montada, login por HTTPS, cookie seguro, avisos ao vivo pelo
Caddy, redirecionamento http→https, certificado para download e primeiro backup.

## Apps

### Instalável pelo navegador (pronto para usar)
O sistema é um app instalável (manifesto, ícones e página "sem conexão"):
Chrome/Edge → *Instalar app*; iPhone → Safari → *Adicionar à Tela de Início*.
Funciona em Windows, Mac, Linux, Android e iPhone, sempre atualizado.

### Apps nativos (instaladores)
- `apps/conectar/index.html`: telinha "Conectar ao servidor" — pede o endereço na
  primeira vez, testa, guarda e abre o sistema; depois entra direto (com opção de trocar).
- `apps/desktop`: Tauri (Windows `.msi/.exe`, Linux `.deb/.AppImage`, Mac `.dmg`).
- `apps/mobile`: Capacitor (Android `.apk`), já aceitando o certificado do servidor
  do hotel instalado no celular.
- Os instaladores são montados **na nuvem do GitHub**: *Actions → Apps (instaladores) →
  Run workflow* (Mac é opcional, porque gasta mais minutos). Os arquivos ficam em
  *Artifacts*. Também roda ao criar uma tag `app-v1.0.0`.
- iPhone nativo exige conta de desenvolvedor Apple (US$ 99/ano) e um Mac; enquanto
  isso, o app instalável pelo Safari cobre o iPhone.
- O APK é de "teste" (instalação direta, sem Play Store). Publicar na Play Store exige
  conta de desenvolvedor Google e assinatura — fica para quando o hotel decidir.

## Outros

- Corrigido: o Next voltava a recarregar a página sem parar (agora pelo servidor MCP de
  desenvolvimento, que também gravava o console em `.next/dev/logs`) — desligado em
  `next.config.ts`.
- Traduções (inglês/espanhol) de todas as telas novas.
