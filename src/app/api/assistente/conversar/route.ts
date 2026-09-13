import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { processarMensagem } from "@/lib/assistente/orquestrador";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  let corpo: { conversaId?: string; mensagem?: string; idempotencyKey?: string; transcricaoOriginal?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const conversaId = typeof corpo.conversaId === "string" ? corpo.conversaId : "";
  const mensagem = typeof corpo.mensagem === "string" ? corpo.mensagem : "";
  const requestId = typeof corpo.idempotencyKey === "string" && corpo.idempotencyKey ? corpo.idempotencyKey : randomUUID();
  const transcricaoOriginal = typeof corpo.transcricaoOriginal === "string" ? corpo.transcricaoOriginal : undefined;

  if (!conversaId || !mensagem.trim()) {
    return NextResponse.json({ erro: "Informe conversaId e mensagem." }, { status: 400 });
  }

  const resultado = await processarMensagem({
    usuario,
    conversaId,
    texto: mensagem,
    origemEntrada: transcricaoOriginal ? "AUDIO" : "TEXTO",
    transcricao: transcricaoOriginal,
    requestId,
  });

  return NextResponse.json(resultado);
}
