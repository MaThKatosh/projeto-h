# Fase 8 — Melhorias de operação

Concluída em 12/11/2026, a partir dos pedidos depois do uso da Fase 7.

## Contas pendentes (hóspede saiu sem pagar uma parte)

- No **check-out**, passo 2: *"O hóspede não vai pagar agora? Deixar pendente"*.
  Marque as cobranças que ficam para depois (ex.: frigobar), escreva o motivo e
  confirme. O saldo some da conta do quarto e o **quarto pode ser liberado**.
- A conta pendente vai para **Financeiro → ⏳ Contas pendentes**:
  - **Receber** (Pix, cartão, dinheiro...) — entra no borderô do dia em que for pago,
    no setor "Contas pendentes"; ao zerar, fica **Quitada**.
  - **Dar baixa (perda)** — só gerente/admin, com motivo.
- A reserva (e qualquer reserva nova do mesmo hóspede) mostra o aviso
  *"Este hóspede tem conta pendente em aberto"*.
- Uma cobrança só pode ir para pendente uma vez; o lançamento "conta pendente" não
  é estornável pela conta (resolve-se pela tela de pendentes).
- No check-out, quando o botão *Confirmar* está apagado, agora aparece o porquê
  ("Para liberar: receba R$ X ou deixe pendente").

> O "erro no check-out do 401" relatado foi uma falha momentânea: o banco foi
> atualizado (Fase 7) com o servidor de teste ainda ligado. Reiniciado, o fluxo
> funciona.

## Ficha do hóspede mais segura

- **CPF** com dígitos verificadores (111.111.111-11, 123.456.789-00 → recusados).
- **Nascimento**: data real, não futura, no máximo 120 anos (11/11/1111 → recusado).
- **CEP** do Brasil com 8 números (formatado 00000-000); estrangeiro fica livre.
- **Países**: listas de nacionalidade e país de residência (200 países, no idioma
  do funcionário).
- **⧉ Copiar telefone, e-mail e endereço do titular** nas fichas dos acompanhantes.
- **Check-in só com fichas completas** de todos (titular e acompanhantes, uma ficha
  por pessoa da reserva): nome e sobrenome, documento, nascimento, nacionalidade,
  sexo, país, cidade (e estado, se Brasil). O check-in e a entrada direta mostram
  uma ficha para cada pessoa.
- Erros aparecem no campo certo (antes alguns só diziam "Revise os campos").

## Recepção mais enxuta

Uma tela com duas abas — **Entradas pendentes** e **Saídas pendentes** — com o
número em cada aba. Cada linha: quarto (e se está pronto), hóspede, pessoas ou
quanto falta pagar, e o botão de check-in / check-out.

## Garagem com limite de vagas

*Tarifas → 🚗 Estacionamento → Vagas* (0 = sem limite). Com a garagem lotada o
sistema não deixa registrar outro veículo (no check-in nem no botão "Veículo").
A tela Garagem mostra "X de Y" vagas.

## Pedidos dos hóspedes (QR code no quarto)

- *Pedidos dos hóspedes → 🖨 QR codes dos quartos*: um cartão por quarto para
  imprimir e colar. Imprima acessando pelo endereço do servidor (não "localhost").
- O hóspede aponta a câmera e abre uma página simples (PT/EN/ES, sem login):
  🧹 limpeza, 🧺 toalhas, 🧴 itens de higiene, 🛠 problema (ar, chuveiro, TV, Wi-Fi...)
  ou 💬 outro pedido, e acompanha o andamento.
- **Problema** vira na hora uma ocorrência de prioridade alta na Manutenção.
- A equipe vê tudo em **🔔 Pedidos dos hóspedes** (com contador no menu, ao vivo):
  *Vou atender* → *Concluído*.
- Segurança: só funciona com o quarto ocupado (pedidos ficam ligados à estadia;
  o próximo hóspede não vê os do anterior), até 6 pedidos por hora por quarto e
  sem repetir o mesmo pedido em 10 minutos. *trocar código* invalida um QR copiado.

## Borderô por usuário e setor

- Relatório **Borderô**: colunas e filtros de **Funcionário** e **Setor**
  (Recepção / Restaurante / Contas pendentes), com totais por setor e por pessoa.
- **Caixa por funcionário**: agora separado por setor.
- O Financeiro do dia e a auditoria noturna também somam o recebido de pendentes.

## Revenue management (📈 Revenue)

- **Indicadores**: ocupação, diária média (ADR) e RevPAR dos próximos 30 dias (o que
  já está reservado) e dos últimos 30 dias (números da auditoria), e quantas reservas
  entraram na última semana.
- **Calendário de preços** (14 ou 30 dias): por tipo de quarto e noite, quartos
  livres e **preço sugerido** (verde = acima da base, azul = abaixo; o mouse mostra
  as regras que valeram).
- **Regras** (gerente/admin), que se somam entre -50% e +200%:
  📈 ocupação alta (≥ X%) · 📅 dias da semana · 🎉 período/evento · ⏱ última hora.
  Cada uma pode valer para todos os tipos ou só um.
- Preço base = tarifa ativa (a primeira em ordem alfabética).
- Na **nova reserva** aparece *"📈 Sugerido: R$ X — usar"* (média das noites).
- A API do channel manager (`/api/integracoes/disponibilidade`) passa a enviar
  `suggestedPriceCents` por noite.
- No banco de teste ficou a regra de exemplo **"Fim de semana" (+10% sexta e
  sábado)** — edite ou apague em *Revenue → Regras de preço*.
