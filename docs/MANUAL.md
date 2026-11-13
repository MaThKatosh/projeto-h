# Manual dos funcionários

O mesmo conteúdo aparece no sistema em **❓ Ajuda** (cada um vê o que o seu cargo usa).
Arquivo gerado de `lib/help/content.ts` — edite lá e rode `npx tsx scripts/gerar-manual.ts`.

## 👋 Primeiros passos

*Para: todos*

1. Entre com o usuário e a senha que o gerente criou para você.
2. No primeiro acesso, troque a senha em Meu perfil (canto de baixo do menu).
3. Em Meu perfil também dá para escolher o idioma (português, inglês ou espanhol).
4. O menu da esquerda só mostra o que o seu cargo pode usar.
5. As telas se atualizam sozinhas (bolinha verde "Ao vivo"): não precisa recarregar.

## ▦ Mapa de quartos

*Para: todos*

1. Cada porta é um quarto. A cor mostra a situação: verde livre e limpo, azul ocupado, amarelo sujo, laranja em arrumação, vermelho manutenção, cinza bloqueado.
2. O número está na plaquinha da porta; embaixo aparecem o hóspede e o dia de saída.
3. Toque na porta para ver os detalhes e as ações permitidas ao seu cargo.
4. Use a busca (quarto ou hóspede) e os botões de andar para achar rápido.

## 📅 Fazer uma reserva

*Para: Admin, Gerente, Recepção*

1. Reservas → + Nova reserva.
2. Procure o hóspede pelo nome, CPF ou telefone (para não cadastrar duas vezes) ou cadastre um novo.
3. Escolha as datas, o número de pessoas e o tipo de quarto (só aparecem os que têm vaga).
4. A diária vem da tarifa; o sistema mostra o preço sugerido (📈) — toque em "usar" se quiser.
5. Confirmar reserva. O quarto pode ser escolhido agora ou depois.

> 💡 Reservas do Booking/Expedia: Reservas → ⇪ Importar do portal (arquivo baixado do extranet).

## 🛎 Check-in

*Para: Admin, Gerente, Recepção*

1. Recepção → aba Entradas pendentes → Check-in no hóspede.
2. 1. Escolha um quarto limpo e livre.
3. 2. Preencha a ficha de TODOS os hóspedes: documento (CPF válido), nascimento, nacionalidade, sexo e residência. Use ⧉ Copiar do titular para o endereço e o telefone dos acompanhantes.
4. 3. Motivo da viagem e transporte (ficha FNRH). 4. Veículo, se houver.
5. Confirmar check-in. Se faltar algo, aparece a lista do que falta e os campos ficam em vermelho.
6. Imprima a ficha (🖨 Ficha FNRH) para o hóspede assinar.

> 💡 Hóspede sem reserva: 🛎 Entrada direta (cria a reserva e já faz o check-in).

## 💳 Conta do quarto, pagamentos e estornos

*Para: Admin, Gerente, Recepção*

1. Na reserva, a Conta mostra cobranças (diárias, ISS, garagem, frigobar, restaurante) e pagamentos.
2. 💵 Receber pagamento: escolha a forma (e a bandeira no cartão). Nunca digite o número do cartão — só o NSU.
3. + Lançar cobrança para extras (lavanderia, danos...).
4. Lançou errado? O gerente usa "estornar" com o motivo (nada é apagado, fica registrado).

## 🧳 Check-out

*Para: Admin, Gerente, Recepção*

1. Recepção → aba Saídas pendentes → Check-out.
2. 1. Lançar as diárias que faltam. 2. Receber o saldo. 3. Confirmar a saída.
3. O hóspede não vai pagar uma parte agora? No passo 2: "Deixar pendente" → marque o que fica para depois e explique. O quarto é liberado.
4. O quarto vai sozinho para a governança como sujo; o veículo sai da garagem.

> 💡 Contas pendentes ficam em Financeiro → ⏳ Contas pendentes (receber depois ou dar baixa).

## 🧹 Governança (arrumação)

*Para: Admin, Gerente, Governança, Recepção*

1. Governança mostra os quartos para arrumar, em arrumação e os limpos de hoje.
2. Toque em ▶ Começar ao entrar no quarto e ✓ Terminei ao sair: o mapa fica verde na hora para a recepção.
3. ★ marca prioridade (ex.: hóspede chegando). A governanta escolhe o responsável de cada quarto.
4. Viu um problema? Abra uma ocorrência para a manutenção pelo próprio quarto.
5. 📋 Saídas do dia: lista de quem sai hoje e quem já saiu, para planejar o dia.

## 🔧 Manutenção

*Para: Admin, Gerente, Manutenção, Governança, Recepção*

1. Qualquer um abre uma ocorrência (título, prioridade e, se precisar, "fora de venda").
2. A manutenção assume, começa o conserto, comenta e resolve. Tudo fica no histórico.
3. Quarto fora de venda não aparece para check-in até a ocorrência ser resolvida.

## 🔔 Pedidos dos hóspedes (QR do quarto)

*Para: Admin, Gerente, Recepção, Governança, Manutenção*

1. O hóspede aponta a câmera para o QR colado no quarto e pede limpeza, toalhas, itens de higiene ou relata um problema.
2. O pedido aparece em 🔔 Pedidos dos hóspedes (o número vermelho no menu mostra quantos estão abertos).
3. Toque em "Vou atender" e depois em "Concluído". Problemas viram ocorrência da manutenção sozinhos.

## 🍽 Restaurante, cozinha e frigobar

*Para: Admin, Gerente, Recepção, Restaurante, Governança*

1. Restaurante: toque na mesa → + Abrir comanda → escolha os itens → Enviar para a cozinha.
2. Cozinha vê os pedidos na hora e marca quando estão prontos.
3. Fechar a comanda: receber na hora ou lançar no quarto do hóspede (vai para a conta dele).
4. Frigobar: escolha o quarto e toque nos itens consumidos; vai direto para a conta.

## 🌙 Auditoria noturna (fechar o dia)

*Para: Admin, Gerente, Recepção*

1. Todo fim de noite: Auditoria noturna.
2. Resolva o que estiver em vermelho (chegadas e saídas do dia).
3. Rodar auditoria: lança as diárias da noite e vira a data do sistema.
4. Rodou por engano? O gerente usa "Desfazer a auditoria".

## 📊 Relatórios

*Para: Admin, Gerente, Recepção*

1. Escolha o relatório, o período e os filtros (forma de pagamento, funcionário, setor...).
2. 🖨 Imprimir sai só o relatório; ⬇ Excel abre direto no Excel.
3. Borderô: o que entrou no caixa por forma, funcionário e setor. Caixa por funcionário: fechamento de turno.

## ⚙️ Gerência: configurações, preços e correções

*Para: Admin, Gerente*

1. Configurações: nome do hotel, horários, formas de pagamento, bandeiras, idioma padrão, channel manager.
2. Cadastro de quartos, Tarifas (com ISS e vagas da garagem), Cardápio e Usuários.
3. 📈 Revenue: ocupação prevista, preço sugerido e regras (fim de semana, eventos, ocupação alta).
4. Corrigir erros: desfazer check-in/check-out/auditoria, reativar reserva, estornar — sempre com motivo.
5. Privacidade (LGPD): em Configurações → Privacidade dos hóspedes.

