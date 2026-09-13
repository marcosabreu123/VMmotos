import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { podeEscrever } from "@/lib/permissoes";
import { prisma } from "@/lib/db";
import { cotarFrete, ordenarOpcoes, type DadosCotacao } from "@/lib/integracoes/melhorEnvio/cotacao";
import { registrarCotacao } from "@/lib/integracoes/melhorEnvio/historico";
import { melhorEnvioConfig } from "@/lib/integracoes/melhorEnvio/config";
import { ErroMelhorEnvio } from "@/lib/integracoes/melhorEnvio/client";
import { ErroOAuthMelhorEnvio } from "@/lib/integracoes/melhorEnvio/oauth";
import { registrarAuditoria } from "@/lib/auditoria";

export const maxDuration = 30;

const LIMITE_POR_MINUTO = 12;

export async function POST(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  if (!podeEscrever(usuario, "fretes")) {
    return NextResponse.json({ erro: "Você não tem permissão para cotar fretes." }, { status: 403 });
  }

  let corpo: Partial<DadosCotacao>;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  // Proteção simples contra uso excessivo — sem cache de resposta (preço pode
  // mudar entre uma cotação e outra), só um teto de cotações por minuto.
  const umMinutoAtras = new Date(Date.now() - 60_000);
  const quantidadeRecente = await prisma.cotacaoFrete.count({
    where: { usuarioId: usuario.id, createdAt: { gte: umMinutoAtras } },
  });
  if (quantidadeRecente >= LIMITE_POR_MINUTO) {
    return NextResponse.json({ erro: "Muitas cotações em pouco tempo. Aguarde um instante e tente novamente." }, { status: 429 });
  }

  const dados: DadosCotacao = {
    cepOrigem: String(corpo.cepOrigem ?? ""),
    cepDestino: String(corpo.cepDestino ?? ""),
    pesoKg: Number(corpo.pesoKg),
    alturaCm: Number(corpo.alturaCm),
    larguraCm: Number(corpo.larguraCm),
    comprimentoCm: Number(corpo.comprimentoCm),
    valorDeclaradoCentavos: corpo.valorDeclaradoCentavos !== undefined ? Number(corpo.valorDeclaradoCentavos) : undefined,
    nomeReferencia: corpo.nomeReferencia,
    observacao: corpo.observacao,
  };

  try {
    const resultado = await cotarFrete(dados, usuario);
    const cotacaoSalva = await registrarCotacao({
      usuarioId: usuario.id,
      ambiente: melhorEnvioConfig.environment,
      dados,
      resultado,
    });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "frete.cotar",
      entidade: "CotacaoFrete",
      entidadeId: cotacaoSalva.id,
      detalhes: `${resultado.opcoes.length} opção(ões), ${resultado.indisponiveis.length} indisponível(is)`,
    });

    return NextResponse.json({
      success: true,
      cotacaoId: cotacaoSalva.id,
      quotedAt: cotacaoSalva.createdAt,
      opcoes: ordenarOpcoes(resultado.opcoes, "menor_preco"),
      indisponiveis: resultado.indisponiveis,
    });
  } catch (erro) {
    const mensagem =
      erro instanceof ErroMelhorEnvio || erro instanceof ErroOAuthMelhorEnvio
        ? erro.message
        : "Não foi possível calcular o frete neste momento. Tente novamente.";

    await registrarCotacao({ usuarioId: usuario.id, ambiente: melhorEnvioConfig.environment, dados, erro: mensagem });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "frete.cotar_erro",
      entidade: "CotacaoFrete",
      detalhes: mensagem,
    });

    const status = erro instanceof ErroMelhorEnvio && erro.status ? erro.status : 502;
    return NextResponse.json({ success: false, erro: mensagem }, { status });
  }
}
