import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { podeEscrever } from "@/lib/permissoes";
import { selecionarCotacao } from "@/lib/integracoes/melhorEnvio/historico";
import { registrarAuditoria } from "@/lib/auditoria";
import type { OpcaoFrete } from "@/lib/integracoes/melhorEnvio/cotacao";

// Só grava a opção escolhida no histórico local — NÃO compra o frete, não
// gera etiqueta e não cria nada no Melhor Envio.
export async function POST(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  if (!podeEscrever(usuario, "fretes")) {
    return NextResponse.json({ erro: "Você não tem permissão para selecionar cotações." }, { status: 403 });
  }

  let corpo: { cotacaoId?: string; opcao?: OpcaoFrete };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (!corpo.cotacaoId || !corpo.opcao) {
    return NextResponse.json({ erro: "Informe cotacaoId e a opção escolhida." }, { status: 400 });
  }

  const resultado = await selecionarCotacao(corpo.cotacaoId, usuario.id, corpo.opcao);
  if (resultado.count === 0) {
    return NextResponse.json({ erro: "Cotação não encontrada." }, { status: 404 });
  }

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "frete.selecionar",
    entidade: "CotacaoFrete",
    entidadeId: corpo.cotacaoId,
    detalhes: `${corpo.opcao.transportadora} — ${corpo.opcao.servico}`,
  });

  return NextResponse.json({ ok: true });
}
