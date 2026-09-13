import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { listarFornecedores } from "@/lib/fornecedores";

export async function GET(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const termo = request.nextUrl.searchParams.get("q") ?? "";
  const fornecedores = await listarFornecedores(termo);

  return NextResponse.json(fornecedores);
}
