import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { criarConversa, listarConversas } from "@/lib/assistente/conversas";

export async function GET() {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const conversas = await listarConversas(usuario.id);
  return NextResponse.json(conversas);
}

export async function POST(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  let corpo: { titulo?: string } = {};
  try {
    corpo = await request.json();
  } catch {
    // corpo vazio é válido — "nova conversa" sem título
  }

  const conversa = await criarConversa(usuario.id, corpo.titulo);
  return NextResponse.json(conversa);
}
