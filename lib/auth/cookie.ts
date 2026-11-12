// Configuração do cookie de sessão. Sem dependências do servidor para
// poder ser usada também pelo proxy.ts.

const isProduction = process.env.NODE_ENV === "production";

// Fica false até o sistema rodar com HTTPS (Fase 7). Na rede interna do
// hotel, em http://IP-DO-SERVIDOR, um cookie "Secure" não seria salvo.
const useSecure = isProduction && process.env.COOKIE_SECURE === "1";

export const SESSION_COOKIE = useSecure ? "__Host-hotel_session" : "hotel_session";

// Turno de trabalho: a sessão expira em 14 h sem uso.
export const SESSION_COOKIE_MAX_AGE = 14 * 60 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: useSecure,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_COOKIE_MAX_AGE,
};
