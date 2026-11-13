import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta: um navegador de verdade fazendo os fluxos da
// recepção num hotel de demonstração (banco hotel_e2e, recriado a cada vez).
// Rodar: npm run e2e   (relatório: npx playwright show-report)
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // os testes mexem no mesmo hotel: um de cada vez
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3200",
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Usa o Microsoft Edge que já vem no Windows (sem baixar navegador).
  // Em Linux/Mac: npx playwright install chromium e PW_CHANNEL=chromium.
  projects: [{ name: "edge", use: { ...devices["Desktop Edge"], channel: process.env.PW_CHANNEL || "msedge" } }],
  webServer: {
    command: "node e2e/server.mjs",
    url: "http://localhost:3200/api/saude",
    timeout: 600_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
