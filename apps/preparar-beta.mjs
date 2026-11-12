// Prepara a versão beta dos apps: endereço do servidor embutido e nome/ID
// próprios (instala ao lado do app normal). Uso: node apps/preparar-beta.mjs https://...
import { readFileSync, writeFileSync } from "node:fs";

const url = (process.argv[2] || "").trim().replace(/\/+$/, "");
if (!/^https?:\/\/[\w.-]+(:\d+)?$/.test(url)) {
  console.error("Endereço inválido:", url);
  process.exit(1);
}
writeFileSync("apps/conectar/config.js", `// Versão beta: servidor embutido.\nwindow.HOTEL_SERVER = ${JSON.stringify(url)};\n`);

const tauri = "apps/desktop/src-tauri/tauri.conf.json";
const t = JSON.parse(readFileSync(tauri, "utf8"));
t.productName = "Sistema do Hotel (Beta)";
t.identifier = "br.com.projetoh.hotel.beta";
t.app.windows[0].title = "Sistema do Hotel (Beta)";
writeFileSync(tauri, JSON.stringify(t, null, 2));

const cap = "apps/mobile/capacitor.config.json";
const c = JSON.parse(readFileSync(cap, "utf8"));
c.appId = "br.com.projetoh.hotel.beta";
c.appName = "Hotel (Beta)";
writeFileSync(cap, JSON.stringify(c, null, 2));
console.log("Versão beta preparada para", url);
