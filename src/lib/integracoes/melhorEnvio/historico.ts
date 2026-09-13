import { prisma } from "@/lib/db";
import type { AmbienteMelhorEnvio } from "./config";
import type { DadosCotacao, OpcaoFrete, ResultadoCotacao } from "./cotacao";

export type DadosRegistroCotacao = {
  usuarioId: string;
  ambiente: AmbienteMelhorEnvio;
  dados: DadosCotacao;
  resultado?: ResultadoCotacao;
  erro?: string;
};

export async function registrarCotacao(params: DadosRegistroCotacao) {
  const { usuarioId, ambiente, dados, resultado, erro } = params;
  const menorPreco = resultado?.opcoes.length ? Math.min(...resultado.opcoes.map((o) => o.precoCentavos)) : null;
  const menorPrazo = resultado?.opcoes.length
    ? Math.min(...resultado.opcoes.filter((o) => o.prazoDias !== null).map((o) => o.prazoDias as number))
    : null;

  return prisma.cotacaoFrete.create({
    data: {
      usuarioId,
      ambiente,
      cepOrigem: dados.cepOrigem.replace(/\D/g, ""),
      cepDestino: dados.cepDestino.replace(/\D/g, ""),
      pesoKg: dados.pesoKg,
      alturaCm: dados.alturaCm,
      larguraCm: dados.larguraCm,
      comprimentoCm: dados.comprimentoCm,
      valorDeclaradoCentavos: dados.valorDeclaradoCentavos ?? null,
      nomeReferencia: dados.nomeReferencia?.trim() || null,
      observacao: dados.observacao?.trim() || null,
      quantidadeOpcoes: resultado?.opcoes.length ?? 0,
      menorPrecoCentavos: menorPreco,
      menorPrazoDias: menorPrazo ?? null,
      status: erro ? "erro" : resultado && resultado.opcoes.length === 0 ? "parcial" : "sucesso",
      erro: erro ?? null,
    },
  });
}

export async function selecionarCotacao(cotacaoId: string, usuarioId: string, opcao: OpcaoFrete) {
  return prisma.cotacaoFrete.updateMany({
    where: { id: cotacaoId, usuarioId },
    data: { opcaoSelecionadaJson: opcao },
  });
}

export type FiltrosHistoricoFrete = {
  usuarioId?: string;
  dataInicio?: Date;
  dataFim?: Date;
  cepDestino?: string;
  status?: string;
  pagina?: number;
  porPagina?: number;
};

export async function listarHistoricoFretes(filtros: FiltrosHistoricoFrete = {}) {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const porPagina = filtros.porPagina ?? 20;

  const where = {
    ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
    ...(filtros.cepDestino ? { cepDestino: { contains: filtros.cepDestino.replace(/\D/g, "") } } : {}),
    ...(filtros.status ? { status: filtros.status } : {}),
    ...(filtros.dataInicio || filtros.dataFim
      ? { createdAt: { gte: filtros.dataInicio, lte: filtros.dataFim } }
      : {}),
  };

  const [cotacoes, total] = await Promise.all([
    prisma.cotacaoFrete.findMany({
      where,
      include: { usuario: true },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.cotacaoFrete.count({ where }),
  ]);

  return { cotacoes, total, pagina, porPagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export async function buscarCotacaoPorId(id: string) {
  return prisma.cotacaoFrete.findUnique({ where: { id }, include: { usuario: true } });
}
