import { prisma } from "./db";

export type DadosAuditoria = {
  usuarioId: string;
  acao: string;
  entidade: string;
  entidadeId?: string | null;
  detalhes?: string | null;
  valorAnterior?: number | null; // centavos — só quando a ação altera um valor numérico auditável
  valorNovo?: number | null;
};

// Gravação de auditoria é sempre fora da transação de negócio — uma falha
// aqui nunca deve reverter a ação real que já aconteceu, só fica sem registro.
export async function registrarAuditoria(dados: DadosAuditoria): Promise<void> {
  try {
    await prisma.registroAuditoria.create({
      data: {
        usuarioId: dados.usuarioId,
        acao: dados.acao,
        entidade: dados.entidade,
        entidadeId: dados.entidadeId ?? null,
        detalhes: dados.detalhes ?? null,
        valorAnterior: dados.valorAnterior ?? null,
        valorNovo: dados.valorNovo ?? null,
      },
    });
  } catch (erro) {
    console.error("Falha ao registrar auditoria:", erro);
  }
}

export type FiltrosAuditoria = {
  usuarioId?: string;
  acao?: string;
  entidade?: string;
  dataInicio?: Date;
  dataFim?: Date;
  pagina?: number;
  porPagina?: number;
};

export async function listarAuditoria(filtros: FiltrosAuditoria = {}) {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const porPagina = filtros.porPagina ?? 30;

  const where = {
    ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
    ...(filtros.acao ? { acao: filtros.acao } : {}),
    ...(filtros.entidade ? { entidade: filtros.entidade } : {}),
    ...(filtros.dataInicio || filtros.dataFim
      ? { createdAt: { gte: filtros.dataInicio, lte: filtros.dataFim } }
      : {}),
  };

  const [registros, total] = await Promise.all([
    prisma.registroAuditoria.findMany({
      where,
      include: { usuario: true },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.registroAuditoria.count({ where }),
  ]);

  return { registros, total, pagina, porPagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export async function listarAcoesDistintas(): Promise<string[]> {
  const linhas = await prisma.registroAuditoria.findMany({
    distinct: ["acao"],
    select: { acao: true },
    orderBy: { acao: "asc" },
  });
  return linhas.map((l) => l.acao);
}
