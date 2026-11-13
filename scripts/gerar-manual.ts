import { writeFileSync } from "node:fs";
import { HELP } from "@/lib/help/content";
const roleName: Record<string, string> = { ADMIN: "Admin", GERENTE: "Gerente", RECEPCAO: "Recepção", GOVERNANCA: "Governança", MANUTENCAO: "Manutenção", RESTAURANTE: "Restaurante" };
let md = "# Manual dos funcionários\n\nO mesmo conteúdo aparece no sistema em **❓ Ajuda** (cada um vê o que o seu cargo usa).\nArquivo gerado de `lib/help/content.ts` — edite lá e rode `npx tsx scripts/gerar-manual.ts`.\n\n";
for (const t of HELP) {
  md += `## ${t.icon} ${t.title}\n\n*Para: ${t.roles === "todos" ? "todos" : t.roles.map((r) => roleName[r]).join(", ")}*\n\n`;
  md += t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") + "\n";
  if (t.tip) md += `\n> 💡 ${t.tip}\n`;
  md += "\n";
}
writeFileSync("docs/MANUAL.md", md);
console.log("docs/MANUAL.md gerado");
