# Versão de teste (beta) para amigos

Um **hotel de demonstração** (dados fictícios) rodando neste PC, com um **link
público** gratuito da Cloudflare. Os amigos usam pelo navegador (qualquer aparelho)
ou pelos **apps beta** (Windows e Android), que já vêm com o link embutido.

## Ligar o beta

```
powershell -ExecutionPolicy Bypass -File deploy\beta\iniciar-beta.ps1
```

- Liga o servidor de teste (Docker, porta 3100, banco separado do seu) e cria o link
  `https://....trycloudflare.com` (mostrado na tela e salvo em `deploy/beta/link.txt`).
- **Deixe a janela aberta** e o PC ligado (sem suspender). Fechou → o link para.
- O link **muda** cada vez que o script roda de novo (ex.: depois de reiniciar o PC).
  O script publica o link novo num **gist secreto** do seu GitHub
  (`deploy/beta/gist-id.txt`), e os **apps beta consultam esse gist ao abrir**: eles
  acham o link novo sozinhos (pode levar até 5 minutos). Só quem usa pelo navegador
  precisa receber o link novo.
- Se o PC suspender ou a janela fechar, o link cai: rode o script de novo.

## O que os amigos veem

- Faixa "🧪 Versão de teste — dados fictícios".
- Na tela de entrada, botões com as contas de teste (senha de todas: **teste123**):
  `gerente`, `recepcao`, `governanca`, `manutencao`, `restaurante`.
  As senhas dessas contas não podem ser trocadas (ninguém tranca os outros).
- Botão **💬 Sugestão / erro** em todas as telas.

## Ler as sugestões

Entre como `gerente` (ou `admin` — senha em `deploy/beta/.env`) → menu
**Sugestões dos testadores**. Cada mensagem vem com quem mandou, a tela e o
aparelho. Marque "✓ Resolvido" conforme for tratando.

## Recomeçar o hotel de demonstração do zero

```
docker compose -f deploy/beta/docker-compose.yml down -v
powershell -ExecutionPolicy Bypass -File deploy\beta\iniciar-beta.ps1
```

(`down -v` apaga o banco do beta — inclusive as sugestões; o seu banco de
desenvolvimento não é afetado.)

## Mensagem pronta para mandar

> Oi! Tô fazendo um sistema de hotel e queria que você testasse 🙂
> **Pelo navegador:** <link>
> **App Android:** <apk> — **Windows:** <exe> (o Windows avisa "editor desconhecido":
> clique em *Mais informações → Executar assim mesmo*)
> Na tela de entrada escolha um cargo (recepcao, governanca, gerente...) — a senha é
> **teste123**. É tudo de mentira, pode mexer à vontade! Se algo der erro ou tiver
> ideia, usa o botão laranja **"💬 Sugestão / erro"**. Valeu!

## Cuidados

- O link é público: qualquer pessoa com ele vê o hotel de **demonstração** (nada do
  hotel de verdade nem do seu banco de desenvolvimento).
- Desligue quando não estiver testando: feche a janela do script e, se quiser,
  `docker compose -f deploy/beta/docker-compose.yml stop`.
