# Fase 2 — Governança e manutenção

Concluída em 12/11/2026.

## Governança (`/governanca`)

Painel pensado para a camareira usar no celular.

- **Três colunas:** Para arrumar · Em arrumação · Limpos hoje.
- **Ordem de trabalho automática:** primeiro os quartos marcados com ★ prioridade,
  depois os **vazios** (podem ser vendidos assim que ficarem limpos) e por
  último os que esperam há mais tempo.
- **Botões grandes:** ▶ Começar → ✓ Terminei. "Parar" devolve o quarto para
  "Para arrumar". "Eu arrumo" pega um quarto sem responsável.
- **A governanta** (cargo Governança), o gerente e o administrador escolhem o
  responsável de cada quarto e marcam prioridade.
- **Números no topo:** para arrumar, em arrumação, limpos hoje, tempo médio de
  arrumação hoje.
- **Filtros:** "Meus e sem responsável" (padrão para camareiras), "Só quartos
  livres" e "Todos".

### Como a tarefa nasce e termina

A tarefa de limpeza acompanha a situação do quarto, venha a mudança de onde
vier (mapa, painel da governança ou manutenção):

| Quarto fica… | Tarefa |
|---|---|
| Sujo | nasce (ou volta) como "Para arrumar" |
| Em arrumação | "Em arrumação", começa a contar o tempo |
| Limpo | concluída: guarda quem terminou e quanto levou |

O banco garante que cada quarto tem **no máximo uma** tarefa aberta.
Não é possível arrumar um quarto em manutenção ou bloqueado.

## Manutenção (`/manutencao`)

- **Ocorrência** = um problema a resolver, num quarto **ou numa área** (piscina,
  recepção…). Tem número curto ("ocorrência 12"), prioridade (baixa, média,
  alta, urgente), responsável e linha do tempo.
- **Colunas:** Aberta · Em andamento · Aguardando (peça, terceiro…) ·
  Encerradas nos últimos 7 dias. A mais urgente fica em cima.
- **Ações:** Eu resolvo · Começar · Aguardando (diz o quê) · Resolvido (diz o
  que foi feito) · Reabrir · Comentar · trocar responsável/prioridade ·
  Cancelar (só gerente e administrador).
- **Fora de venda:** ao abrir (ou depois), marca-se se o hóspede não pode ficar
  no quarto. Enquanto a ocorrência estiver aberta, o quarto fica "Em manutenção".
- **Números no topo:** abertas, urgentes, quartos fora de venda, resolvidas hoje.

### A cor do quarto agora vem das ocorrências

| Ocorrências abertas do quarto | Manutenção do quarto |
|---|---|
| nenhuma | Sem problemas |
| alguma | Com problema (selo ⚠) |
| alguma "fora de venda" | Em manutenção (vermelho) |

**Bloquear** continua sendo manual (ex.: reforma), pelo mapa, e vale mais que
as ocorrências. Quarto ocupado não pode ser bloqueado.

## A corrente completa (exemplo testado)

1. Recepção avisa: "vazamento no banheiro do 106", urgente, fora de venda.
2. O 106 fica vermelho no mapa de todo mundo, na hora.
3. A manutenção clica em Começar e depois Resolvido ("troquei a vedação").
4. O 106 volta a "sem problemas" **e fica Sujo**, e nasce sozinha uma tarefa na
   governança.
5. A camareira arruma; o 106 fica verde e pode ser vendido.

## Mapa

O painel do quarto agora mostra:
- quem está arrumando (ou se está esperando), com link para a governança;
- as ocorrências abertas do quarto, com link para cada uma;
- o botão **⚠ Avisar problema** (formulário curto, sem sair do mapa);
- **Bloquear / Desbloquear** para manutenção, gerente e administrador.

"Com problema" e "Em manutenção" não se escolhem mais à mão: saem das ocorrências.

## Quem pode o quê

| Ação | Quem pode |
|---|---|
| Ver painel da governança | Governança, Recepção, Gerente, Admin |
| Começar/terminar arrumação | Governança, Recepção, Gerente, Admin |
| Escolher responsável e prioridade da arrumação | Governança, Gerente, Admin |
| Ver painel da manutenção e comentar | Todos, menos o Restaurante |
| Avisar problema | Todos, menos o Restaurante |
| Trabalhar na ocorrência, bloquear/desbloquear quarto | Manutenção, Gerente, Admin |
| Cancelar ocorrência | Gerente, Admin |

## Dados da Fase 1

A migration `fase2_regras_e_dados` converteu o que já existia: quartos sujos ou
em arrumação viraram tarefas, e quartos com problema ou em manutenção viraram
ocorrências (usando a observação como título).

## Testes

`npm test`: 24 testes (cálculo da manutenção pelas ocorrências, ações válidas
por situação, validação da ocorrência, ordem de arrumação, ordem das
ocorrências, regras de bloqueio, mais os da Fase 1). No navegador: começar e
terminar uma arrumação, a corrente completa do 106, avisar problema pelo mapa
e o que uma camareira vê na manutenção (só comentar).

## Problema encontrado no ambiente

O modo de desenvolvimento do Next entrava num ciclo de recarregar a página sem
parar (o log do navegador gravado em `.next/dev/logs` disparava recompilação).
Resolvido com `logging.browserToTerminal: false` no `next.config.ts`.

## Fica para depois

- Prioridade automática para check-out e chegada do dia: depende das reservas (Fase 3).
- Inspeção da supervisora depois da limpeza e cargo "Supervisor(a) de governança".
- Fotos na ocorrência.
- Relatórios (tempo por camareira, ocorrências por quarto): Fase 6.
