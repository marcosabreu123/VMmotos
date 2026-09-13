import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { buscarClientes } from "@/lib/clientes";

export async function GET(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const termo = request.nextUrl.searchParams.get("q") ?? "";
  const clientes = await buscarClientes(termo);

  return NextResponse.json(clientes);
}
