import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { gerarUrlAutorizacao, ErroOAuthMelhorEnvio } from "@/lib/integracoes/melhorEnvio/oauth";

export async function GET(request: NextRequest) {
  const usuario = await requireOwner();

  try {
    const url = await gerarUrlAutorizacao(usuario);
    return NextResponse.redirect(url);
  } catch (erro) {
    const mensagem =
      erro instanceof ErroOAuthMelhorEnvio ? erro.message : "Não foi possível iniciar a conexão com o Melhor Envio.";
    const destino = new URL("/integracoes/melhor-envio", request.url);
    destino.searchParams.set("erro", mensagem);
    return NextResponse.redirect(destino);
  }
}
