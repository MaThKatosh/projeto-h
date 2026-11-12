# Fase 5 — Restaurante e frigobar

Concluída em 12/11/2026.

## Restaurante (`/restaurante`)

- **Salão**: mesas em cartões — verde tracejado = livre; laranja = ocupada (nº da
  comanda, pessoas, há quanto tempo, total); verde cheio = tem prato pronto para
  levar. Números no topo: mesas ocupadas, itens na cozinha, prontos para levar.
- **Abrir comanda** numa mesa, no **balcão** ou como **serviço de quarto**
  (escolhendo o hóspede). Pode já ligar ao hóspede para lançar no quarto depois.
- **Comanda** (`/restaurante/comanda/[id]`):
  - cardápio em botões grandes, por grupo, com busca; monta o pedido com + / −
    e observação por item ("sem cebola"); **Enviar pedido**;
  - itens com situação: *Na cozinha* → *Pronto p/ levar* → *Entregue*. Bebidas e
    itens que não passam pela cozinha já saem como entregues;
  - **taxa de serviço** (10% por padrão) liga/desliga por comanda;
  - **fechar**: lançar o que falta na **conta do quarto** do hóspede, ou **receber
    aqui** (dinheiro com **troco calculado**, Pix, cartões, transferência; aceita
    dividir em mais de um pagamento) e fechar paga.
- Preço é **copiado** no momento do pedido: mudar o cardápio não muda comandas.

## Cozinha (`/cozinha`)

- Fichas por mesa, da mais antiga para a mais nova, com observações em destaque.
- Cor pela espera: normal, **amarela a partir de 10 min**, **vermelha a partir de 20 min**.
- Botão grande **Pronto**; o garçom vê na hora na comanda e no salão.
- Lista de "prontos aguardando o garçom" com "entregue".

## Frigobar (`/frigobar`)

- Escolhe o quarto, marca com + / − o que foi consumido e **lança tudo na conta**
  de uma vez (uma cobrança por item, com quantidade e preço).
- **Para repor hoje**: soma do que foi consumido, por item. E a lista de
  lançamentos do dia (quarto, item, quem lançou, hora).
- **Na governança**, quarto ocupado tem o botão **🧃 Frigobar**, que já abre com o
  quarto escolhido (a camareira confere durante a arrumação).

## Cardápio e mesas (`/cardapio`, gerente/admin)

Itens do restaurante e do frigobar (nome, grupo, preço, se vai para a cozinha,
ativo), mesas (nome, lugares, ativa) e a taxa de serviço padrão. Os dados de
exemplo (8 mesas, 13 itens do restaurante, 8 do frigobar) podem ser ajustados aqui.

## Interligação

- Comanda lançada no quarto e frigobar entram na **conta do quarto** (categorias
  Restaurante e Frigobar) e aparecem no histórico da reserva.
- **Check-out recusa** se o hóspede tiver comanda aberta no restaurante.
- **Financeiro**: o borderô soma o que o restaurante recebeu na hora, separado
  por forma de pagamento ("restaurante: R$ …").
- Lançamento errado no quarto: o gerente estorna na conta (regra da Fase 4).

## Quem pode o quê

| Ação | Quem pode |
|---|---|
| Restaurante (abrir, pedir, receber, lançar no quarto) | Restaurante, Recepção, Gerente, Admin |
| Cancelar item ainda na cozinha | quem usa o restaurante |
| Cancelar item já preparado / comanda com itens | Gerente, Admin |
| Tela da cozinha | Restaurante, Gerente, Admin |
| Lançar frigobar | Governança, Recepção, Gerente, Admin |
| Cardápio, mesas, taxa de serviço | Gerente, Admin |

## Testes

`npm test`: 61 testes (total da comanda com serviço, itens cancelados, pagos,
troco, validações, permissões, mais os das fases anteriores).

No navegador: mesa 1 com filé + 2 refrigerantes (R$ 93,50 com serviço); o filé
apareceu na cozinha, "Pronto" refletiu na comanda ao vivo; pago em dinheiro com
R$ 100 (troco R$ 6,50); mesa liberada. Mesa 2 com o hóspede do 104: comanda de
R$ 55,00 lançada na conta do quarto. Frigobar do 104: 2 águas + 1 chocolate
(R$ 23,00) na conta, lista de reposição certa. Financeiro somando o dinheiro do
restaurante. Cardápio, governança (botão Frigobar), cozinha e salão abrem sem erro.

## Fica para depois

- Impressão da comanda/pedido na cozinha (impressora térmica): Fase 7.
- Transferir itens entre mesas, juntar mesas, dividir conta por pessoa.
- Estoque do frigobar e do restaurante (entrada/saída de mercadoria).
- Relatórios de vendas do restaurante e café da manhã: Fase 6.
