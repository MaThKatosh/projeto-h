# Fase 4 — Conta do quarto, pagamentos e estornos

Concluída em 12/11/2026.

## A conta do quarto

Cada reserva tem uma conta, que aparece na tela da reserva.

- **Cobranças** (o hóspede deve): diária, ISS, estacionamento (lançados pelo
  sistema) e lavanderia, telefone, danos, outros (lançados à mão, com quantidade
  e valor unitário). Frigobar e restaurante terão telas próprias na Fase 5.
- **Pagamentos** (o hóspede pagou): dinheiro, Pix, cartão de crédito (com
  parcelas), cartão de débito, transferência. Campo opcional para NSU,
  autorização ou ID do Pix. **O número do cartão nunca é digitado nem guardado**:
  o sistema recusa números com cara de cartão.
- **Saldo** = cobranças − pagamentos: "A pagar" em vermelho, "Crédito do hóspede"
  em azul, "Zerada ✓" em verde.
- **Sinal / pré-pagamento**: dá para receber pagamento e lançar cobrança (ex.:
  multa) antes do check-in.
- **Devolução de crédito**: quando o hóspede pagou a mais, devolve-se em
  dinheiro/Pix/etc. com motivo.

## Estorno (lançamento indevido)

- Nenhum lançamento é apagado ou alterado — **regra garantida pelo próprio banco**
  (testado: alterar ou apagar direto no banco é recusado).
- Estornar cria um lançamento com valor negativo ligado ao original; o original
  fica riscado com quem estornou, quando e o motivo.
- **Só gerente e administrador estornam**, sempre com motivo. Não se estorna um
  estorno, nem conta já encerrada.

## Diárias

- Cada noite gera: **diária** + **ISS** (se a reserva cobra ISS) + **estacionamento**
  por veículo que estava na garagem naquela noite (se houver valor configurado).
- O banco impede cobrar a mesma noite duas vezes (a não ser que a anterior tenha
  sido estornada).
- Diárias vencidas e não lançadas aparecem em amarelo na conta com "Lançar agora".
  **Na Fase 6 a auditoria noturna lança sozinha** (a função já está pronta para isso).
- O valor do **estacionamento por noite** é configurado em Tarifas (0 = grátis).

## Check-out agora fecha a conta (3 passos)

1. **Fechar a conta**: lança as diárias que faltam (mostra quantas e quanto).
2. **Receber**: o valor do saldo já vem sugerido; escolhe a forma de pagamento.
3. **Confirmar a saída**: só libera com a conta **zerada**. O servidor confere de
   novo: com saldo a pagar, crédito a devolver ou diária faltando, recusa.

Saída antecipada: só as noites usadas são cobradas (mínimo de 1 noite).

**Cancelamento** com sinal pago é recusado até devolver o valor (ou lançar a multa
como cobrança): dinheiro do hóspede não fica "perdido".

## Financeiro (`/financeiro`)

- **Borderô do dia** (pela data do sistema): total recebido em dinheiro, Pix,
  crédito, débito e transferência, já descontando estornos e devoluções.
- Cobranças do dia por tipo, lista de **estornos e devoluções**, todos os
  lançamentos do dia (com hora e quem fez).
- **Contas abertas**: hóspedes na casa com saldo e diárias a lançar.
- Dá para ver dias anteriores.

## Quem pode o quê

| Ação | Quem pode |
|---|---|
| Ver contas e Financeiro | Recepção, Gerente, Admin |
| Lançar cobranças, receber pagamentos, devolver crédito, lançar diárias | Recepção, Gerente, Admin |
| Estornar | Gerente, Admin |
| Valor do estacionamento | Gerente, Admin |

## Testes

`npm test`: 50 testes (saldo, estorno anulando o original, crédito e devolução,
noites a lançar, saída efetiva, ISS arredondado, veículo por noite, validação dos
formulários, mais os das fases anteriores).

No navegador (reserva nº 12, quarto 302): lavanderia 2 × R$ 15; Pix de R$ 100;
estorno do Pix pelo gerente; check-out em 3 passos (diária R$ 270 + ISS R$ 13,50,
total R$ 313,50 pago no crédito, conta zerada, saída liberada); borderô do dia
conferindo; alteração e exclusão direto no banco recusadas.

**Corrigido durante o teste:** os formulários da conta continuavam abertos depois
de concluídos; o aviso "saída antecipada" aparecia em estadia de 1 noite.

## Fica para depois

- Lançamento automático das diárias toda noite: Fase 6 (auditoria).
- Conta separada para empresa / faturamento, dividir conta, transferir lançamento
  entre quartos.
- Estorno depois do check-out (reabrir conta).
- Fechamento de caixa por funcionário/turno: Fase 6 (relatórios).
