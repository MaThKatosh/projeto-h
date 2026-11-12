# Fase 9 — Check-in claro, saídas para a governança, portas e apps

Concluída em 12/11/2026.

## Check-in: o motivo aparece

Antes, o botão "Confirmar check-in" ficava apagado (sem quarto escolhido) ou o
navegador bloqueava em silêncio (campo obrigatório vazio, às vezes fora da tela).
Agora, ao clicar, aparece a caixa **"Ainda não dá para fazer o check-in"** com tudo
o que falta, por pessoa — por exemplo:

- Escolha o quarto (passo 1).
- Titular: falta CPF válido, nascimento, sexo.
- Acompanhante 1: falta nome e sobrenome, documento, nascimento...

Os campos ficam em vermelho e a tela rola até o primeiro. Vale também para a
**entrada direta**. O servidor continua conferindo tudo de novo.

## Relatório "Saídas do dia (governança)"

*Relatórios → Governança e manutenção*, ou o atalho **📋 Saídas do dia** na tela da
Governança. Para o dia escolhido: quarto, andar, tipo, se o hóspede **já saiu** (e a
que horas), **ainda está no quarto** ou está com **saída atrasada**, pessoas,
situação da limpeza, responsável e prioridade. Imprime e sai em Excel.
Podem ver: governança, recepção, gerente e admin.

## Mapa com portas

Cada quarto aparece como uma **porta** na cor da situação (verde livre, azul
ocupado, amarelo sujo, laranja em arrumação, vermelho manutenção, cinza
bloqueado), com o **número na plaquinha dourada**, maçaneta e o "aviso de porta"
pendurado com o ícone da situação. Embaixo: tipo, hóspede/saída e selos
(problema, chega hoje...). Os cartões da Governança também mostram a porta.

## Apps instaláveis (executáveis)

Montados pelo GitHub (*Actions → Apps (instaladores)*) e publicados em
**GitHub → Releases** do repositório:

| Plataforma | Arquivo | Como instalar |
|---|---|---|
| Windows | `.msi` ou `-setup.exe` | Dois cliques. O Windows pode avisar "editor desconhecido" (app sem assinatura paga): *Mais informações → Executar assim mesmo*. |
| Linux | `.deb` / `.AppImage` | `sudo apt install ./arquivo.deb`, ou dar permissão de execução ao `.AppImage`. |
| Mac | `.dmg` | Arraste para Aplicativos. Na 1ª vez: botão direito → *Abrir* (app sem assinatura Apple). |
| Android | `.apk` | Copie para o celular, abra e permita "instalar apps desconhecidos". |
| iPhone | — | Pelo Safari: *Compartilhar → Adicionar à Tela de Início* (app nativo exige conta Apple). |

Na primeira abertura o app pede o **endereço do servidor** (ex.: `https://192.168.0.10`)
e depois entra direto. Na rede do hotel, instale antes o certificado do servidor no
aparelho (docs/INSTALACAO.md, seção 3).

Para montar de novo (ex.: depois de mudar a tela de conexão): *Actions → Apps
(instaladores) → Run workflow*. Os apps só "embrulham" o sistema: atualizações do
sistema chegam sozinhas, sem reinstalar o app.
