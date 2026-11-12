# Fase 3 — Reservas, tarifas, check-in/out, troca de quarto e garagem

Concluída em 12/11/2026.

## Telas novas

| Tela | Para quê |
|---|---|
| **Recepção** (`/recepcao`) | O dia: chegadas e saídas pendentes (atrasadas em vermelho), quartos ocupados, % de ocupação, hóspedes na casa, quartos prontos. Botões diretos de check-in e check-out. |
| **Reservas** (`/reservas`) | **Mapa de reservas**: quartos × 14 dias, cada reserva uma barra colorida (confirmada, hospedado, saiu); reservas sem quarto ficam numa linha "sem quarto" do tipo. **Lista**: chegadas, hospedados, saídas, futuras, todas; busca por nome, nº, quarto ou código do portal. |
| **Nova reserva** (`/reservas/nova`) | Busca o hóspede (nome, CPF, telefone) para não duplicar; mostra **quantos quartos livres de cada tipo** há em todas as noites; preenche diária, café e ISS pela tarifa; total previsto com ISS; origem (Balcão, Booking, Hoteis.com, Expedia, Decolar, Airbnb…) e nº da reserva no portal; quarto opcional. |
| **Entrada direta** (`/reservas/nova?direto=1`) | Hóspede sem reserva: cria e já faz o check-in num quarto limpo. |
| **Reserva** (`/reservas/[id]`) | Tudo de uma reserva: check-in, check-out, trocar quarto, escolher quarto, alterar (datas, valores, pessoas), cancelar, não compareceu, acompanhantes, veículos, histórico. |
| **Garagem** (`/garagem`) | Veículos na casa, vaga, quarto, data de saída; busca por placa; registrar saída. |
| **Tarifas** (`/tarifas`, gerente/admin) | Tarifas com diária por tipo de quarto, café incluso, **cobrar ISS (sim/não) e alíquota**. |

## Regras importantes

- **Ocupação do quarto agora é real**: só muda por check-in, check-out e troca de quarto.
- **Check-in** exige quarto **livre e limpo** (sem manutenção que impeça) e o
  **documento** do hóspede (ficha). Pode registrar o veículo na hora.
- **Check-out** libera o quarto, manda para a governança como **sujo** e dá
  saída nos veículos. Saída antecipada libera as noites não usadas.
- **Troca de quarto** exige motivo; o quarto antigo vai sujo para a governança;
  fica registrada (relatório da Fase 6).
- **Nunca duas reservas no mesmo quarto na mesma noite** — garantido pelo
  próprio banco, mesmo se duas pessoas tentarem ao mesmo tempo.
- **Sem overbooking por tipo**: a reserva só é aceita se houver quarto do tipo
  livre em TODAS as noites. Quartos bloqueados não contam.
- **Upgrade**: ao colocar a reserva num quarto de outro tipo, o tipo da reserva
  acompanha (a disponibilidade continua certa).
- **Valores copiados**: a reserva guarda a diária/ISS combinados; mudar a tarifa
  depois não altera reservas feitas. Dinheiro sempre em centavos.
- **Data do sistema**: "hoje" do hotel. Vira na auditoria noturna (Fase 6). Até
  lá o gerente usa "Avançar data do sistema" na recepção (só até o dia do calendário).

## Interligação com as fases anteriores

- **Mapa de quartos**: cartão mostra o hóspede e "sai dd/mm" ou **"sai hoje"**;
  quarto com chegada do dia mostra **"➜ chega hoje"**; busca também por nome do
  hóspede; o painel do quarto tem "Abrir reserva" e "Fazer check-in/check-out".
- **Governança**: quarto sujo com hóspede chegando hoje vai para o **topo da fila**
  com o selo "Chega hoje" (antes isso dependia de marcar prioridade à mão).

## Quem pode o quê

| Ação | Quem pode |
|---|---|
| Ver recepção, reservas e garagem | Recepção, Gerente, Admin |
| Criar/alterar reservas, check-in/out, troca, garagem | Recepção, Gerente, Admin |
| Tarifas | Gerente, Admin |
| Avançar data do sistema | Gerente, Admin |

## Dados convertidos

A migration `fase3_reservas` criou a tarifa **Balcão** (com preço por tipo e ISS 5%),
a data do sistema e transformou os 10 quartos "ocupados" do exemplo em
hospedagens com um "Hóspede de exemplo NNN" (entrada ontem, saída em 2 dias).

## Testes

`npm test`: 39 testes (datas, dinheiro em formato brasileiro, totais com ISS,
disponibilidade por noite, quarto pronto para check-in, validação da estadia,
placa, fila da governança com chegadas, mais os das fases anteriores).
Verificação de tipos e lint sem erros.

## Teste no navegador

Feito depois de reiniciar o computador (o WSL do Windows tinha travado e derrubado o Docker):

1. Nova reserva (hóspede novo, Standard Casal, tarifa Balcão): R$ 210,00 + ISS 5% = R$ 220,50.
2. Check-in sem documento: recusado. Com CPF e veículo ABC1D23: quarto 107 ocupado.
3. Troca para o 110 com motivo: 107 ficou livre e sujo, com tarefa na governança; troca registrada.
4. Check-out: 110 livre e sujo, com tarefa na governança; o veículo saiu da garagem sozinho.
5. Entrada direta no Luxo 302: reserva criada e check-in feito com a diária certa (R$ 270,00).
6. Recepção, mapa de reservas, lista, garagem, tarifas, mapa de quartos, governança e manutenção: abrem sem erro.

**Erro encontrado e corrigido:** a entrada direta revalidava dados já convertidos;
era recusada, e a diária seria multiplicada por 100. Agora repassa os dados originais.

## Fica para depois

- Conta do quarto, pagamentos e cobrança de estacionamento: Fase 4.
- Tarifa por temporada / fim de semana (hoje: uma diária por reserva).
- Importar reservas dos portais automaticamente: Fase 7 (já existe origem + nº do portal).
- Tela própria de hóspedes (histórico de estadias) e ficha FNRH: Fase 6/7.
