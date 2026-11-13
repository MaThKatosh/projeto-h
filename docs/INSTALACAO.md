# Instalação no hotel ou na nuvem

O sistema roda num **servidor** (um computador do hotel ou um servidor na nuvem).
Os outros aparelhos — computadores da recepção, celulares da governança, tablet do
restaurante — só abrem o endereço dele, pelo navegador ou pelo app.

| | PC do hotel | Nuvem |
|---|---|---|
| Custo | nenhum (usa um PC que fica ligado) | aluguel do servidor (≈ R$ 30–100/mês) + domínio |
| Sem internet | **continua funcionando** na rede interna | o hotel fica sem sistema |
| Acesso de fora do hotel | precisa configurar (VPN) | de qualquer lugar |
| HTTPS | certificado próprio: instalar 1 vez em cada aparelho | automático e gratuito (Let's Encrypt) |
| Cópias de segurança | no próprio PC — **copie para fora** (pendrive/nuvem) | no servidor — idem |

Dá para começar num e mudar para o outro depois (restaurando um backup).

---

## 1. Opção A — Computador do hotel (Windows)

**Requisitos:** Windows 10/11, 8 GB de RAM, ligado o tempo todo, de preferência
com cabo de rede e **IP fixo** (peça ao técnico de rede para reservar o IP no roteador).

1. Instale o **Docker Desktop**: https://www.docker.com/products/docker-desktop/
   - Nas configurações dele, ligue **"Start Docker Desktop when you sign in"**.
2. Baixe o projeto (pasta do GitHub) neste computador.
3. Abra o PowerShell na pasta do projeto e rode:
   ```
   powershell -ExecutionPolicy Bypass -File deploy\instalar.ps1
   ```
   - Escolha **1** (rede interna) e confirme o endereço do computador (ex.: `192.168.0.10`).
   - **Anote a senha do admin** que aparece (só aparece uma vez).
4. Libere o firewall do Windows para os outros aparelhos (PowerShell **como administrador**):
   ```
   New-NetFirewallRule -DisplayName "Sistema do Hotel" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow
   ```
5. Nas **Opções de energia** do Windows: suspensão = **Nunca**.
6. Instale o certificado em cada aparelho (seção 3) e abra `https://192.168.0.10`.

> Linux ou Mac como servidor do hotel: mesma coisa com `bash deploy/instalar.sh`.

## 2. Opção B — Nuvem

1. Alugue um servidor Linux (Ubuntu 24.04, 2 GB de RAM ou mais) em qualquer provedor.
2. Compre/use um domínio e crie o apontamento: `sistema.meuhotel.com.br` → IP do servidor
   (registro **A** no painel do domínio).
3. No servidor, instale o Docker (https://docs.docker.com/engine/install/ubuntu/),
   baixe o projeto e rode:
   ```
   bash deploy/instalar.sh
   ```
   Escolha **2**, informe o domínio e um e-mail. **Anote a senha do admin.**
4. Abra `https://sistema.meuhotel.com.br`. O certificado é emitido sozinho em ~1 minuto.

## 3. Certificado nos aparelhos (só na Opção A)

Na rede interna o servidor usa um certificado próprio. Cada aparelho precisa
"confiar" nele **uma vez**. Baixe em `http://ENDEREÇO-DO-SERVIDOR/certificado.crt`
(ex.: `http://192.168.0.10/certificado.crt`) e:

- **Windows:** abra o arquivo → *Instalar certificado* → *Máquina local* → *Colocar todos
  os certificados no repositório a seguir* → **Autoridades de Certificação Raiz Confiáveis** → Concluir.
- **Android:** *Configurações → Segurança → Mais configurações → Criptografia e credenciais →
  Instalar um certificado → Certificado de CA* → escolha o arquivo baixado.
- **iPhone/iPad:** abra o link no **Safari** → *Permitir* → *Ajustes → Geral → VPN e
  Gerenciamento de Dispositivos* → instale o perfil → *Ajustes → Geral → Sobre →
  Ajustes de Confiança de Certificados* → ligue a chave do certificado.
- **Mac:** abra o arquivo (vai para o *Acesso às Chaves*) → clique duas vezes no
  certificado → *Confiar* → **Confiar Sempre**.

Pronto: o cadeado aparece e o navegador não reclama mais.

## 4. Instalar como app

- **Computador (Chrome ou Edge):** abra o sistema → ícone de instalar na barra de
  endereço (ou menu ⋮ → *Instalar Sistema do Hotel*). Ganha ícone e janela própria.
- **Android (Chrome):** menu ⋮ → *Instalar app* / *Adicionar à tela inicial*.
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.
- **Instaladores nativos** (opcional): veja `docs/FASE-7.md` → "Apps nativos".

## 5. Atualizar o sistema

Baixe a versão nova do projeto (GitHub) e rode o mesmo instalador de novo
(`deploy\instalar.ps1` ou `bash deploy/instalar.sh`). Ele detecta que já está
instalado, atualiza o banco sozinho e mantém todos os dados.

## 6. Cópias de segurança

- O serviço `backup` faz uma cópia completa do banco **todo dia** em `deploy/backups/`
  (arquivos `hotel-AAAA-MM-DD_HHMM.dump`) e apaga as com mais de 30 dias.
- Cada cópia também vai, sozinha, para uma **segunda pasta** escolhida na instalação
  (`BACKUP_COPY_DIR` no `deploy/.env`). No Windows o instalador sugere a pasta do
  **OneDrive**, que sobe para a nuvem de graça; serve também Google Drive, Dropbox ou
  um HD externo. Se o computador queimar, é essa cópia que salva o hotel.
- Para mudar a pasta depois: edite `BACKUP_COPY_DIR` em `deploy/.env` e rode o
  instalador de novo.
- Para voltar uma cópia (apaga os dados atuais!):
  ```
  bash deploy/restaurar-backup.sh deploy/backups/hotel-2026-12-01_0300.dump
  ```
  (no Windows, rode pelo *Git Bash*, que vem com o Git.)

## 7. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Aparelho diz "não seguro" / "certificado inválido" | Instale o certificado (seção 3). |
| Nenhum aparelho abre, só o servidor | Firewall do Windows (seção 1, passo 4) ou IP do servidor mudou. |
| IP do servidor mudou | Reserve IP fixo no roteador; edite `SERVER_ADDRESS` em `deploy/.env` e rode o instalador de novo. O certificado já instalado nos aparelhos continua valendo. |
| Esqueci a senha do admin | Outro gerente/admin redefine em *Usuários*. Se não houver nenhum, peça suporte técnico. |
| Ver o que está acontecendo | `docker compose -f deploy/docker-compose.yml logs app --tail 50` |

Arquivo `deploy/.env`: guarda as senhas do banco e do primeiro admin. **Não
compartilhe e não envie ao GitHub** (já está protegido no `.gitignore`).
