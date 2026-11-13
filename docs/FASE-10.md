# Fase 10 — Pronto para uso (sem custos)

Concluída em 12/11/2026. Tudo o que dava para fazer sem gastar dinheiro nem
depender de contrato/credencial do hotel.

## Manual dos funcionários (❓ Ajuda)

- Menu **❓ Ajuda**: passo a passo do que cada cargo usa (recepção vê reserva,
  check-in, conta, check-out, auditoria...; governança vê arrumação, pedidos...).
  "ver o manual inteiro" mostra todos os tópicos.
- Versão para imprimir: **[MANUAL.md](MANUAL.md)**. O conteúdo fica em
  `lib/help/content.ts`; depois de editar, rode `npx tsx scripts/gerar-manual.ts`.
- O texto do manual está em português (os menus e botões da página seguem o idioma).

## LGPD (privacidade dos hóspedes)

- **Política de privacidade pública** em `/privacidade` (link na tela de entrada e na
  página do QR do quarto). É um modelo: revise com o jurídico e coloque o contato
  do encarregado de dados (DPO).
- **Configurações → 🔒 Privacidade dos hóspedes**:
  - buscar um hóspede → **⬇ Exportar dados** (arquivo com tudo o que o hotel guarda
    sobre ele: cadastro, estadias, conta) ou **Anonimizar** (apaga nome, documento,
    contatos, endereço e placas; mantém estadias e valores para a contabilidade);
  - **limpeza de cadastros antigos**: anonimiza quem não se hospeda há mais de X anos
    (padrão 5). Quem tem reserva ativa ou conta pendente fica de fora.
- Tudo fica no relatório "Registro de ações".

## Importar hóspedes do sistema antigo

**Configurações → 📥 Importar hóspedes**: planilha CSV do sistema antigo. Reconhece
colunas comuns (nome, CPF/documento, nascimento, e-mail, telefone, sexo, cidade, UF,
país, CEP, endereço), descobre o tipo de documento, valida CPF/data/CEP e mostra a
prévia (Novo / Já existe / Problema) antes de gravar. Não duplica quem já está
cadastrado (mesmo documento, ou mesmo nome + e-mail). Há um modelo para baixar.
(As reservas futuras entram por *Reservas → Importar do portal*, com o modelo próprio.)

## Backup fora do servidor

O backup diário agora também é copiado para uma **segunda pasta** escolhida na
instalação (`BACKUP_COPY_DIR`). No Windows o instalador sugere a pasta do
**OneDrive** (sobe sozinha para a nuvem, de graça). Testado: o arquivo sai nas duas
pastas; as cópias com mais de 30 dias são apagadas nas duas.

## Testes de ponta a ponta

`npm run e2e` abre um navegador de verdade (o Microsoft Edge do Windows) e faz:

1. entrar e ver o mapa de portas;
2. check-in: aparece o que falta, preenche a ficha do acompanhante (com "copiar do
   titular") e conclui;
3. check-out deixando o frigobar pendente, pagando o resto, e recebendo a pendente
   no Financeiro;
4. hóspede pede toalhas pelo QR (sem login) e a equipe vê o pedido.

Roda num banco só dele (`hotel_e2e`, recriado do zero com o hotel de demonstração)
e num servidor na porta 3200 — não mexe nos seus dados nem no beta. Se algo falhar,
`npx playwright show-report` mostra a tela e o passo do erro.

## O que ficou de fora (precisa de dinheiro ou do hotel)

- NFS-e (emissor pago + certificado digital), envio da FNRH ao governo (credencial do
  hotel), channel manager específico (contrato), assinatura dos apps, iPhone/Play
  Store, integração com a maquininha (TEF) e endereço fixo para o beta.
