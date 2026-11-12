import type { NextConfig } from "next";

// Outros aparelhos do hotel acessam pelo IP do servidor (ex.:
// 192.168.0.10:3000). Em desenvolvimento o Next bloqueia origens
// desconhecidas; ALLOWED_DEV_ORIGINS libera os IPs da rede local.
const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins,
  // Não repassar o console do navegador para o servidor: neste Windows o
  // arquivo de log (.next/dev/logs) disparava recompilação → recarga da
  // página → novo log, num ciclo sem fim.
  logging: { browserToTerminal: false },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
