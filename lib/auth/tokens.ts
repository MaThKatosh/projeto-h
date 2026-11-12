import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Token de sessão: 256 bits aleatórios. O cookie leva o token; o banco
// guarda apenas o SHA-256 dele.

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Para chaves de rate limit: não guardar e-mail em claro.
export function hashIdentifier(value: string): string {
  return createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

// Comparação em tempo constante (o tempo de resposta não revela quantos
// caracteres do código estavam certos).
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
