# Configurações, botões de desfazer e idiomas

Concluída em 12/11/2026, entre a Fase 6 e a Fase 7.

## Configurações (`/configuracoes`)

Uma tela só para o gerente ajustar o hotel, sem mexer em código:

- **Dados do hotel**: nome (aparece no login, no menu e na aba do navegador),
  horários de check-in e check-out, idioma padrão do hotel.
- **Formas de pagamento aceitas**: liga/desliga Crédito, Débito, Pix e Dinheiro.
  Uma forma desligada some das telas de pagamento.
- **Bandeiras de cartão**: Visa, Mastercard, Elo, Amex, Hipercard e Diners já vêm
  cadastradas; dá para incluir outras, renomear ou desativar. Em crédito e débito
  a bandeira é obrigatória e aparece no borderô ("Cartão Visa", "Cartão Elo"...).
  O número do cartão nunca é guardado — a maquininha processa.
- **Atalhos** para o que já era configurável: quartos e tipos (quantidade de
  quartos), tarifas e garagem, cardápio (restaurante e frigobar), usuários.

Quem pode: Admin e Gerente.

## Corrigir erros com um botão

| Problema | Onde | Botão |
|---|---|---|
| Rodei a auditoria por engano / duas vezes | Auditoria | **Desfazer última auditoria** — volta a data do sistema e estorna as diárias que ela lançou |
| Fiz check-in no quarto/hóspede errado | Reserva | **Desfazer check-in** — volta a reserva para confirmada e libera o quarto (só sem lançamentos na conta) |
| Fiz check-out cedo demais | Reserva | **Desfazer check-out** — o hóspede volta para o quarto (se o quarto ainda estiver livre) |
| Cancelei ou marquei "não compareceu" sem querer | Reserva | **Reativar reserva** (se ainda houver vaga) |
| Lançamento errado na conta | Conta do quarto | **Estornar** (já existia) |

Todos pedem um motivo, ficam no histórico (quem, quando, por quê) e só aparecem
para Admin e Gerente. O sistema recusa com uma mensagem clara quando desfazer
bagunçaria outra coisa (ex.: desfazer auditoria depois que alguém já fez check-in
no dia novo).

A auditoria desfeita continua no histórico, riscada, com o motivo. A partir daí
pode ser rodada de novo normalmente.

## Idiomas: português, inglês e espanhol

- **Tela de entrada**: botões PT · EN · ES.
- **Cada funcionário** escolhe o seu em *Meu perfil → Idioma* (ou "Padrão do hotel").
- **Padrão do hotel**: em Configurações.

Todas as telas, menus, avisos, relatórios e o Excel exportado são traduzidos.
Ficam em português: o que foi digitado/gravado (nomes de quartos e tipos, itens
do cardápio, descrições já lançadas na conta, como "Diária 12/11") e algumas
mensagens de erro mais raras. Valores e datas continuam no formato brasileiro
(R$ 1.234,56 e 12/11/2026).

### Para quem mexe no código

- Texto de tela: `tr("Texto em português")`; com variáveis: `tr("Quarto {0}", [n])`.
  Em componente de cliente `const tr = useT()`; no servidor `const tr = await getT()`.
- Traduções em `lib/i18n/messages/table-*.json`, linhas `[pt, en, es]`.
  Texto sem tradução aparece em português (nunca quebra).
