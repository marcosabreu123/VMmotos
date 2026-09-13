import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

const ROTAS_PUBLICAS = ["/login"];

/**
 * Arquivos estáticos servidos de /public — logo, ícones, manifest, fontes.
 *
 * Sem esta exceção o middleware trata /logo.svg como rota protegida e
 * responde 307 para /login; a imagem nunca carrega e a marca some justamente
 * da tela de login, que é onde o usuário ainda NÃO tem sessão.
 *
 * É uma lista fechada de extensões de asset, e não "qualquer caminho com
 * ponto", para que nenhuma rota de dados (/api/... .json, por exemplo) escape
 * da checagem de sessão por acidente.
 */
const ARQUIVOS_ESTATICOS = /\.(svg|png|jpe?g|gif|webp|avif|ico|txt|xml|webmanifest|woff2?)$/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    ROTAS_PUBLICAS.some((rota) => pathname.startsWith(rota)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname === "/favicon.ico" ||
    (!pathname.startsWith("/api/") && ARQUIVOS_ESTATICOS.test(pathname))
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.usuario) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
