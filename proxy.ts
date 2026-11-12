import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

// Checagem RÁPIDA: só vê se o cookie existe. A verificação real é feita
// por verifySession() em cada página e ação (lib/auth/dal.ts).

const PUBLIC_PATHS = ["/entrar"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // /hospede/<código>: página do QR do quarto, para o hóspede (sem login).
  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/hospede/");
  if (!hasToken && !isPublic) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Páginas apenas; as APIs verificam a sessão por conta própria.
  // Também livres: manifesto, service worker e página offline do app instalável.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|ico)$).*)"],
};
