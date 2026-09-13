import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { buscarProdutosParaVenda } from "@/lib/produtos";
import { nicho } from "@/config/nicho";


const GENEROS_VALIDOS: string[] = nicho.atributos.atributoB.opcoes.map((o) => o.valor);

export async function GET(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const termo = request.nextUrl.searchParams.get("q") ?? "";
  const generoParam = request.nextUrl.searchParams.get("atributoB");
  const atributoB = GENEROS_VALIDOS.find((valor) => valor === generoParam);

  const produtos = await buscarProdutosParaVenda({ termo, atributoB });

  return NextResponse.json(produtos);
}
