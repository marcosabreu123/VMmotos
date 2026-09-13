import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/auth";
import { processarCallback, ErroOAuthMelhorEnvio } from "@/lib/integracoes/melhorEnvio/oauth";
import { ErroMelhorEnvio } from "@/lib/integracoes/melhorEnvio/client";

// Nunca aceita um destino de redirect vindo do cliente/query string — o
// destino após o callback é sempre esta URL interna fixa.
export async function GET(request: NextRequest) {
  const usuario = await requireOwner();
  const destino = new URL("/integracoes/melhor-envio", request.url);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const erroRecebido = request.nextUrl.searchParams.get("error");

  if (erroRecebido) {
    destino.searchParams.set("erro", "Autorização recusada no Melhor Envio.");
    return NextResponse.redirect(destino);
  }
  if (!code || !state) {
    destino.searchParams.set("erro", "Retorno inválido do Melhor Envio (faltou código ou state).");
    return NextResponse.redirect(destino);
  }

  try {
    await processarCallback({ code, state, usuario });
    destino.searchParams.set("status", "sucesso");
  } catch (erro) {
    const mensagem =
      erro instanceof ErroOAuthMelhorEnvio || erro instanceof ErroMelhorEnvio
        ? erro.message
        : "Não foi possível concluir a conexão com o Melhor Envio.";
    destino.searchParams.set("erro", mensagem);
  }

  return NextResponse.redirect(destino);
}
