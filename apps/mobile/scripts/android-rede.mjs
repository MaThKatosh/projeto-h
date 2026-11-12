// Faz o app Android aceitar o certificado do servidor do hotel instalado
// no celular (rede interna com certificado próprio). Sem isto, o Android
// só confia em certificados "do sistema" e o app não abre o servidor local.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const res = "android/app/src/main/res/xml";
mkdirSync(res, { recursive: true });
writeFileSync(
  `${res}/network_security_config.xml`,
  `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>
  </base-config>
</network-security-config>
`
);
const manifest = "android/app/src/main/AndroidManifest.xml";
let xml = readFileSync(manifest, "utf8");
if (!xml.includes("networkSecurityConfig")) {
  xml = xml.replace("<application", '<application android:networkSecurityConfig="@xml/network_security_config"');
  writeFileSync(manifest, xml);
}
console.log("Android: certificados do usuário liberados para o servidor do hotel.");
