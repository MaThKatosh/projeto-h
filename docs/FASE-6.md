# Fase 6 — Auditoria noturna e relatórios

Concluída em 12/11/2026.

## Auditoria noturna (`/auditoria`)

Fecha o dia do hotel. Substitui o botão provisório "Avançar data" da recepção.

**1. Conferência** (precisa estar tudo verde, menos o aviso amarelo):
- **Chegadas do dia resolvidas**: cada reserva para hoje precisa de check-in,
  "não compareceu" (botão ali mesmo), cancelamento ou nova data.
- **Saídas do dia resolvidas**: quem devia sair precisa de check-out ou prorrogação.
- **Comandas abertas** (aviso, não trava): o que fechar depois entra no dia seguinte.

**2. Prévia**: quantas diárias serão lançadas, para quantos hóspedes, e o valor
(diária + ISS + garagem).

**3. Rodar auditoria** (um clique, com confirmação):
- lança a diária desta noite de todos os hóspedes na casa — e qualquer noite que
  tenha ficado para trás —, registrando no histórico de cada reserva;
- guarda os números do dia: quartos ocupados e disponíveis, hóspedes, receita de
  diárias (para a diária média), receita total, total recebido;
- vira a data do sistema para o dia seguinte.

Tudo numa transação só: se algo falhar, nada é alterado. Uma auditoria por dia
(garantido pelo banco) e uma de cada vez. Não dá para rodar adiantado: a auditoria
do dia X só pode ser feita a partir da noite de X.

**Quem pode**: Recepção (o recepcionista da noite), Gerente e Admin.

A tela mostra também o histórico das últimas auditorias.

## Relatórios (`/relatorios`)

Todos com filtro de datas, **Imprimir** (sai só o relatório, com cabeçalho de
período, quem emitiu e quando) e **Excel (CSV)** (abre direto no Excel brasileiro,
com acentos e vírgula decimal). Cada funcionário só vê os relatórios do seu cargo.
Downloads ficam registrados.

| Grupo | Relatório | Para quê |
|---|---|---|
| Recepção | Hóspedes na casa | quarto, titular, acompanhantes, pessoas, saída, café, veículo, saldo |
| | Lista do café da manhã | para a cozinha: quartos e pessoas da manhã escolhida |
| | Check-ins / Check-outs | entradas e saídas do período |
| | Mudanças de quarto | de/para, motivo, quem fez |
| | Chegadas previstas | reservas que chegam no período |
| | Não comparecimentos e cancelamentos | com motivo |
| Financeiro | **Borderô por forma de pagamento** | crédito, débito, Pix, dinheiro, transferência (filtro por forma), quartos + restaurante |
| | Caixa por funcionário | fechamento de turno |
| | Receitas por tipo | diárias, ISS, estacionamento, restaurante, frigobar… dia a dia |
| | Estornos e devoluções | o quê, quanto, motivo, quem lançou e quem estornou |
| Governança e manutenção | Arrumações por camareira | quartos e tempo médio |
| | Ocorrências de manutenção | situação, prioridade, tempo até fechar, solução |
| Restaurante e frigobar | Vendas do restaurante por item | quantidade e valor |
| | Consumo do frigobar | por item e quarto |
| Gestão | Ocupação e receita por dia | dos números guardados pela auditoria: ocupação %, diária média, receita, recebido |
| | Registro de ações (auditoria do sistema) | logins, estornos, cancelamentos, usuários, auditorias — com filtro por tipo |

Estornos, registro de ações, ocupação e receitas por tipo: só Gerente e Admin.
Novos relatórios são fáceis de acrescentar (`lib/reports/catalog.ts`).

## Testes

`npm test`: 69 testes (somas, formatação, CSV para o Excel, catálogo, períodos,
permissões, mais os das fases anteriores).

No navegador: conferência verde, prévia de 20 diárias (R$ 4.662,00) para 10
hóspedes, auditoria rodada (dia 12/11 fechado: 10/31 quartos, receita
R$ 5.053,50, recebido R$ 407,00; data virou 13/11); segunda auditoria na mesma
noite bloqueada. Os 17 relatórios abriram sem erro com números batendo com os
testes das fases anteriores; CSV do borderô conferido.

## Fica para depois

- Rodar a auditoria sozinha num horário marcado (hoje é um clique, de propósito:
  alguém confere as pendências antes).
- Ficha Nacional de Registro de Hóspedes (FNRH) e nota fiscal: Fase 7.
- Gráficos de ocupação e receita no painel do gerente.
