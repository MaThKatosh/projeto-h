// Servidor dos testes de ponta a ponta: banco próprio (hotel_e2e) recriado do
// zero com o hotel de demonstração, sistema montado em .next-e2e, porta 3200.
// Chamado pelo Playwright (playwright.config.ts) — não precisa rodar à mão.
import "dotenv/config";
import { execSync, spawn } from "node:child_process";
import pg from "pg";

const base = process.env.DATABASE_URL;
if (!base) throw new Error("DATABASE_URL não definida (.env).");
const url = new URL(base);
const dbName = "hotel_e2e";
const e2eUrl = new URL(base);
e2eUrl.pathname = `/${dbName}`;

const admin = new pg.Client({ connectionString: base });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${dbName}`);
await admin.end();
console.log(`[e2e] banco ${dbName} recriado em ${url.host}`);

const env = {
  ...process.env,
  DATABASE_URL: e2eUrl.toString(),
  DEMO_MODE: "1",
  SEED_EXAMPLE: "0",
  SEED_ADMIN_PASSWORD: "admin-e2e-123",
  NEXT_DIST_DIR: ".next-e2e",
  NODE_ENV: "production",
};
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });
run("npx prisma migrate deploy");
run("npx tsx prisma/seed.ts");
run("npx tsx prisma/seed-demo.ts");
if (!process.env.E2E_SKIP_BUILD) run("npx next build");

const server = spawn("npx", ["next", "start", "--port", "3200"], { stdio: "inherit", env, shell: true });
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
