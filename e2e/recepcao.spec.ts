import { expect, test, type Page } from "@playwright/test";

// Fluxos principais da recepção, num navegador de verdade, no hotel de
// demonstração (contas de teste, senha "teste123").

async function login(page: Page, user: string) {
  await page.goto("/entrar");
  await page.locator('input[name="username"]').fill(user);
  await page.locator('input[name="password"]').fill("teste123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/mapa/);
}

test("entrar e ver o mapa de quartos como portas", async ({ page }) => {
  await login(page, "recepcao");
  await expect(page.getByRole("heading", { name: "Mapa de quartos" })).toBeVisible();
  await expect(page.getByText("101", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Versão de teste", { exact: false }).first()).toBeVisible();
});

test("check-in: mostra o que falta e conclui com as fichas completas", async ({ page }) => {
  await login(page, "recepcao");
  await page.goto("/recepcao?aba=entradas");
  // a chegada de 2 pessoas no quarto 107 (titular completo, falta o acompanhante)
  const row = page.locator("div").filter({ has: page.getByText("107", { exact: true }) }).filter({ has: page.getByRole("link", { name: "Check-in" }) }).last();
  await row.getByRole("link", { name: "Check-in" }).click();

  await page.getByRole("button", { name: "Confirmar check-in" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Ainda não dá para fazer o check-in" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Acompanhante 1");

  // quarto 107 (já reservado) e ficha do acompanhante
  await page.getByRole("button", { name: /^107/ }).first().click();
  await page.getByRole("button", { name: /Copiar telefone, e-mail e endereço do titular/ }).first().click();
  await page.locator('input[name="c0_fullName"]').fill("Pedro Teste Acompanhante");
  await page.locator('select[name="c0_docType"]').selectOption("PASSAPORTE");
  await page.locator('input[name="c0_docNumber"]').fill("FX998877");
  await page.locator('input[name="c0_birthDate"]').fill("1990-04-15");
  await page.locator('select[name="c0_gender"]').selectOption("M");
  await page.getByRole("button", { name: "Confirmar check-in" }).click();
  await expect(page.getByText("Check-in feito. Bem-vindo!")).toBeVisible();
});

test("check-out deixando o frigobar pendente e recebendo depois", async ({ page }) => {
  await login(page, "recepcao");
  // hóspede do quarto 101 (tem frigobar lançado)
  await page.goto("/reservas?ver=lista&f=emCasa");
  await page.getByRole("row").filter({ hasText: "101" }).getByRole("link").first().click();
  await page.getByRole("button", { name: /Fazer check-out/ }).click();

  const postNights = page.getByRole("button", { name: "Lançar diárias" });
  if (await postNights.isVisible()) {
    await postNights.click();
    await expect(page.getByText("Todas as diárias da estadia estão na conta.")).toBeVisible();
  }
  await page.getByRole("button", { name: /Deixar pendente/ }).click();
  await page.getByLabel(/Frigobar: Água mineral/).check();
  await page.getByPlaceholder(/vai pagar o frigobar/).fill("Vai pagar por Pix amanhã");
  await page.getByRole("button", { name: /^Deixar R\$/ }).click();
  await expect(page.getByText("Conta pendente criada", { exact: false })).toBeVisible();

  // paga o resto em dinheiro e confirma a saída
  await page.getByRole("button", { name: /Dinheiro/ }).first().click();
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
  // o valor sugerido já desconta a pendente: nada de crédito para devolver
  await expect(page.getByText("Para liberar", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Confirmar check-out" }).click();
  await expect(page.getByText("Check-out feito. Quarto enviado para a governança.")).toBeVisible();

  // a conta pendente aparece no Financeiro e pode ser recebida
  await page.goto("/financeiro/pendentes");
  await expect(page.getByText("Frigobar: Água mineral")).toBeVisible();
  await page.getByRole("button", { name: /Receber/ }).first().click();
  await page.getByRole("button", { name: /Pix/ }).first().click();
  await page.getByRole("button", { name: "Registrar pagamento" }).click();
  // quitada: sai da lista "Em aberto"
  await expect(page.getByText("Nenhuma conta pendente.")).toBeVisible();
  await page.goto("/financeiro/pendentes?ver=todas");
  await expect(page.getByText("Quitada")).toBeVisible();
});

test("hóspede pede toalhas pelo QR e a equipe vê o pedido", async ({ page, browser }) => {
  await login(page, "gerente");
  await page.goto("/quartos/qr");
  // QR do quarto 103 (ocupado no hotel de demonstração)
  const card = page.locator('[data-room="103"]');
  await expect(card.locator("svg")).toBeVisible();
  const url = await card.getAttribute("data-url");
  expect(url).toMatch(/\/hospede\//);

  // Celular do hóspede: sem login
  const guest = await browser.newContext();
  const phone = await guest.newPage();
  await phone.goto(new URL(url!).pathname);
  await expect(phone.getByText("Quarto 103")).toBeVisible();
  await phone.getByRole("button", { name: /Toalhas/ }).click();
  await phone.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(phone.getByText("Pedido enviado!", { exact: false })).toBeVisible();
  await guest.close();

  await page.goto("/pedidos");
  await expect(page.getByText("Toalhas / roupa de cama")).toBeVisible();
});

test("gerência: ajuda, importar hóspedes e privacidade (LGPD)", async ({ page }) => {
  await login(page, "gerente");

  await page.goto("/ajuda");
  await expect(page.getByRole("heading", { name: /Check-in/ })).toBeVisible();

  // importar 1 hóspede novo (e 1 com CPF inválido)
  await page.goto("/configuracoes/importar-hospedes");
  await page.locator('input[type="file"]').setInputFiles({
    name: "clientes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("nome;cpf;nascimento;email\nLúcia Importada Teste;529.982.247-25;10/10/1980;lucia@exemplo.com\nErro Teste;111.111.111-11;;\n"),
  });
  await expect(page.getByText("Novo: 1")).toBeVisible();
  await expect(page.getByText("Problema: 1")).toBeVisible();
  await page.getByRole("button", { name: "Importar 1 hóspede(s)" }).click();
  await expect(page.getByText("1 hóspede(s) importado(s).")).toBeVisible();

  // exportar e anonimizar a importada
  await page.goto("/configuracoes/privacidade");
  await page.getByPlaceholder("Nome, CPF ou telefone").fill("Lúcia Importada");
  await page.getByRole("button", { name: "Buscar" }).click();
  const exportLink = page.getByRole("link", { name: /Exportar dados/ });
  await expect(exportLink).toBeVisible();
  const res = await page.request.get((await exportLink.getAttribute("href"))!);
  expect((await res.json()).hospede.fullName).toBe("Lúcia Importada Teste");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Anonimizar" }).first().click();
  await expect(page.getByText("Hóspede anonimizado.")).toBeVisible();

  // política de privacidade pública (sem login)
  const anon = await page.context().browser()!.newContext();
  const p2 = await anon.newPage();
  await p2.goto("http://localhost:3200/privacidade");
  await expect(p2.getByRole("heading", { name: /Política de privacidade/ })).toBeVisible();
  await anon.close();
});
