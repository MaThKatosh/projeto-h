import type { Role } from "@/lib/permissions";

// ================================================================
// MANUAL DOS FUNCIONÁRIOS — usado na página Ajuda e em docs/MANUAL.md
// Cada tópico diz para quais cargos interessa e traz passos curtos.
// ================================================================

export type HelpTopic = { id: string; icon: string; title: string; roles: Role[] | "todos"; steps: string[]; tip?: string };

const FRONT: Role[] = ["ADMIN", "GERENTE", "RECEPCAO"];
const MGMT: Role[] = ["ADMIN", "GERENTE"];

export const HELP: HelpTopic[] = [
  {
    id: "inicio",
    icon: "👋",
    title: "Primeiros passos",
    roles: "todos",
    steps: [
      "Entre com o usuário e a senha que o gerente criou para você.",
      "No primeiro acesso, troque a senha em Meu perfil (canto de baixo do menu).",
      "Em Meu perfil também dá para escolher o idioma (português, inglês ou espanhol).",
      "O menu da esquerda só mostra o que o seu cargo pode usar.",
      "As telas se atualizam sozinhas (bolinha verde \"Ao vivo\"): não precisa recarregar.",
    ],
  },
  {
    id: "mapa",
    icon: "▦",
    title: "Mapa de quartos",
    roles: "todos",
    steps: [
      "Cada porta é um quarto. A cor mostra a situação: verde livre e limpo, azul ocupado, amarelo sujo, laranja em arrumação, vermelho manutenção, cinza bloqueado.",
      "O número está na plaquinha da porta; embaixo aparecem o hóspede e o dia de saída.",
      "Toque na porta para ver os detalhes e as ações permitidas ao seu cargo.",
      "Use a busca (quarto ou hóspede) e os botões de andar para achar rápido.",
    ],
  },
  {
    id: "reserva",
    icon: "📅",
    title: "Fazer uma reserva",
    roles: FRONT,
    steps: [
      "Reservas → + Nova reserva.",
      "Procure o hóspede pelo nome, CPF ou telefone (para não cadastrar duas vezes) ou cadastre um novo.",
      "Escolha as datas, o número de pessoas e o tipo de quarto (só aparecem os que têm vaga).",
      "A diária vem da tarifa; o sistema mostra o preço sugerido (📈) — toque em \"usar\" se quiser.",
      "Confirmar reserva. O quarto pode ser escolhido agora ou depois.",
    ],
    tip: "Reservas do Booking/Expedia: Reservas → ⇪ Importar do portal (arquivo baixado do extranet).",
  },
  {
    id: "checkin",
    icon: "🛎",
    title: "Check-in",
    roles: FRONT,
    steps: [
      "Recepção → aba Entradas pendentes → Check-in no hóspede.",
      "1. Escolha um quarto limpo e livre.",
      "2. Preencha a ficha de TODOS os hóspedes: documento (CPF válido), nascimento, nacionalidade, sexo e residência. Use ⧉ Copiar do titular para o endereço e o telefone dos acompanhantes.",
      "3. Motivo da viagem e transporte (ficha FNRH). 4. Veículo, se houver.",
      "Confirmar check-in. Se faltar algo, aparece a lista do que falta e os campos ficam em vermelho.",
      "Imprima a ficha (🖨 Ficha FNRH) para o hóspede assinar.",
    ],
    tip: "Hóspede sem reserva: 🛎 Entrada direta (cria a reserva e já faz o check-in).",
  },
  {
    id: "conta",
    icon: "💳",
    title: "Conta do quarto, pagamentos e estornos",
    roles: FRONT,
    steps: [
      "Na reserva, a Conta mostra cobranças (diárias, ISS, garagem, frigobar, restaurante) e pagamentos.",
      "💵 Receber pagamento: escolha a forma (e a bandeira no cartão). Nunca digite o número do cartão — só o NSU.",
      "+ Lançar cobrança para extras (lavanderia, danos...).",
      "Lançou errado? O gerente usa \"estornar\" com o motivo (nada é apagado, fica registrado).",
    ],
  },
  {
    id: "checkout",
    icon: "🧳",
    title: "Check-out",
    roles: FRONT,
    steps: [
      "Recepção → aba Saídas pendentes → Check-out.",
      "1. Lançar as diárias que faltam. 2. Receber o saldo. 3. Confirmar a saída.",
      "O hóspede não vai pagar uma parte agora? No passo 2: \"Deixar pendente\" → marque o que fica para depois e explique. O quarto é liberado.",
      "O quarto vai sozinho para a governança como sujo; o veículo sai da garagem.",
    ],
    tip: "Contas pendentes ficam em Financeiro → ⏳ Contas pendentes (receber depois ou dar baixa).",
  },
  {
    id: "governanca",
    icon: "🧹",
    title: "Governança (arrumação)",
    roles: ["ADMIN", "GERENTE", "GOVERNANCA", "RECEPCAO"],
    steps: [
      "Governança mostra os quartos para arrumar, em arrumação e os limpos de hoje.",
      "Toque em ▶ Começar ao entrar no quarto e ✓ Terminei ao sair: o mapa fica verde na hora para a recepção.",
      "★ marca prioridade (ex.: hóspede chegando). A governanta escolhe o responsável de cada quarto.",
      "Viu um problema? Abra uma ocorrência para a manutenção pelo próprio quarto.",
      "📋 Saídas do dia: lista de quem sai hoje e quem já saiu, para planejar o dia.",
    ],
  },
  {
    id: "manutencao",
    icon: "🔧",
    title: "Manutenção",
    roles: ["ADMIN", "GERENTE", "MANUTENCAO", "GOVERNANCA", "RECEPCAO"],
    steps: [
      "Qualquer um abre uma ocorrência (título, prioridade e, se precisar, \"fora de venda\").",
      "A manutenção assume, começa o conserto, comenta e resolve. Tudo fica no histórico.",
      "Quarto fora de venda não aparece para check-in até a ocorrência ser resolvida.",
    ],
  },
  {
    id: "pedidos",
    icon: "🔔",
    title: "Pedidos dos hóspedes (QR do quarto)",
    roles: ["ADMIN", "GERENTE", "RECEPCAO", "GOVERNANCA", "MANUTENCAO"],
    steps: [
      "O hóspede aponta a câmera para o QR colado no quarto e pede limpeza, toalhas, itens de higiene ou relata um problema.",
      "O pedido aparece em 🔔 Pedidos dos hóspedes (o número vermelho no menu mostra quantos estão abertos).",
      "Toque em \"Vou atender\" e depois em \"Concluído\". Problemas viram ocorrência da manutenção sozinhos.",
    ],
  },
  {
    id: "restaurante",
    icon: "🍽",
    title: "Restaurante, cozinha e frigobar",
    roles: ["ADMIN", "GERENTE", "RECEPCAO", "RESTAURANTE", "GOVERNANCA"],
    steps: [
      "Restaurante: toque na mesa → + Abrir comanda → escolha os itens → Enviar para a cozinha.",
      "Cozinha vê os pedidos na hora e marca quando estão prontos.",
      "Fechar a comanda: receber na hora ou lançar no quarto do hóspede (vai para a conta dele).",
      "Frigobar: escolha o quarto e toque nos itens consumidos; vai direto para a conta.",
    ],
  },
  {
    id: "auditoria",
    icon: "🌙",
    title: "Auditoria noturna (fechar o dia)",
    roles: FRONT,
    steps: [
      "Todo fim de noite: Auditoria noturna.",
      "Resolva o que estiver em vermelho (chegadas e saídas do dia).",
      "Rodar auditoria: lança as diárias da noite e vira a data do sistema.",
      "Rodou por engano? O gerente usa \"Desfazer a auditoria\".",
    ],
  },
  {
    id: "relatorios",
    icon: "📊",
    title: "Relatórios",
    roles: FRONT,
    steps: [
      "Escolha o relatório, o período e os filtros (forma de pagamento, funcionário, setor...).",
      "🖨 Imprimir sai só o relatório; ⬇ Excel abre direto no Excel.",
      "Borderô: o que entrou no caixa por forma, funcionário e setor. Caixa por funcionário: fechamento de turno.",
    ],
  },
  {
    id: "gerencia",
    icon: "⚙️",
    title: "Gerência: configurações, preços e correções",
    roles: MGMT,
    steps: [
      "Configurações: nome do hotel, horários, formas de pagamento, bandeiras, idioma padrão, channel manager.",
      "Cadastro de quartos, Tarifas (com ISS e vagas da garagem), Cardápio e Usuários.",
      "📈 Revenue: ocupação prevista, preço sugerido e regras (fim de semana, eventos, ocupação alta).",
      "Corrigir erros: desfazer check-in/check-out/auditoria, reativar reserva, estornar — sempre com motivo.",
      "Privacidade (LGPD): em Configurações → Privacidade dos hóspedes.",
    ],
  },
];

export function topicsFor(role: Role): HelpTopic[] {
  return HELP.filter((t) => t.roles === "todos" || t.roles.includes(role));
}
