# Fase 1 — Base, usuários e mapa de quartos

Concluída em 12/11/2026.

## O que funciona

- **Login por usuário e senha.** Não existe cadastro aberto: quem cria os
  usuários é o gerente ou o administrador. A sessão dura 14 h sem uso (um
  turno). Depois de 8 senhas erradas em 15 min, aquele usuário fica
  bloqueado naquele aparelho por 15 min.
- **Cargos com hierarquia:** Administrador > Gerente > Recepção > Governança /
  Manutenção / Restaurante. Quem gerencia usuários só cria ou edita cargos
  abaixo do seu (o administrador pode tudo). Ninguém desativa a si mesmo
  nem muda o próprio cargo. Um usuário desativado ou com a senha trocada é
  desconectado na hora.
- **Cadastro de quartos:** tipos de quarto (nome, capacidade) e criação de
  vários quartos de uma vez (ex.: 201 a 215). Dá para desativar um quarto
  (exceto se estiver ocupado).
- **Mapa de quartos ao vivo:**
  - cada quarto é um cartão colorido, separado por andar;
  - a legenda também serve de filtro e mostra quantos quartos há em cada
    situação; ainda dá para filtrar por andar e buscar pelo número;
  - no topo: % de ocupação, quartos prontos para vender, quartos com problema;
  - ao clicar num quarto abre um painel com as ações, a observação e o
    histórico (quem mudou, quando, de quê para quê);
  - quando alguém muda um quarto, todas as telas abertas atualizam na hora,
    o cartão pisca e aparece um aviso no canto da tela.

## Cores do mapa

Cada quarto tem três situações independentes: **ocupação** (livre/ocupado),
**limpeza** (limpo/sujo/em arrumação) e **manutenção** (ok/com
problema/em manutenção/bloqueado). A cor do cartão segue esta prioridade:

| Cor | Situação |
|---|---|
| ⬛ cinza escuro | Bloqueado |
| 🟥 vermelho | Em manutenção |
| 🟦 azul | Ocupado |
| 🟧 laranja | Em arrumação |
| 🟨 amarelo | Sujo |
| 🟩 verde | Livre e limpo (pode vender) |

"Com problema" não muda a cor: aparece como um selo ⚠ no cartão. Um quarto
ocupado e sujo fica azul, com o selo "Sujo".

## Quem pode o quê no quarto

| Ação | Quem pode |
|---|---|
| Limpo / sujo / em arrumação | Governança, Recepção, Gerente, Admin |
| Avisar "com problema" (quarto que estava OK) | Todos, menos o Restaurante |
| Em manutenção, bloquear, liberar | Manutenção, Gerente, Admin |
| Observação | Todos, menos o Restaurante |

**Interligação:** quando um quarto sai da manutenção ou do bloqueio, ele
volta automaticamente como **Sujo**, para a governança arrumar antes de
vender.

As regras ficam em `lib/permissions.ts` e `lib/rooms/rules.ts`; o servidor e
a tela usam a mesma função, e quem decide de verdade é sempre o servidor.

## Como o tempo real funciona

1. Alguém muda um quarto → o servidor grava no banco e manda um aviso pelo
   próprio PostgreSQL (`NOTIFY`).
2. Cada tela aberta mantém uma conexão em `/api/eventos` e recebe o aviso.
3. Se a conexão cai (wi-fi, servidor reiniciou), a tela mostra
   "Reconectando..." e, quando volta, recarrega os dados sozinha.

## Testes

`npm test`: 15 testes de cores, prioridade, permissões, hierarquia e ordem
dos números de quarto. Também foi testado no navegador: login, mapa com
duas abas abertas (uma atualizando a outra), saída de manutenção virando
"Sujo", criação de usuário de Governança (botões de manutenção
desabilitados, sem acesso à tela de usuários) e criação de quartos em lote.

## Fica para depois

- Ocupação muda só pelo check-in/check-out (Fase 3); por enquanto vem do
  exemplo.
- Recuperação de senha por e-mail: não existe; o gerente define uma nova.
- HTTPS e cookie seguro: na Fase 7, ao instalar no hotel (`COOKIE_SECURE=1`).
