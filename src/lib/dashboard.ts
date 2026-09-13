import { prisma } from "./db";
import { inicioDoPeriodo, faturamentoPorPeriodo, type PeriodoRelatorio } from "./relatorios";

// Vendas que ainda contam como faturamento válido para os indicadores — canceladas e
// devolvidas totalmente saem da conta.
const STATUS_FATURAMENTO_VALIDO = ["CONCLUIDA", "DEVOLVIDA_PARCIAL"] as const;

export async function ticketMedio(periodo: PeriodoRelatorio) {
  const { totalCentavos, quantidadeVendas } = await faturamentoPorPeriodo(periodo);
  return quantidadeVendas > 0 ? Math.round(totalCentavos / quantidadeVendas) : 0;
}

// `excluirCanceladas` fica desligado por padrão (usado em /vendas e no histórico
// completo, onde canceladas continuam aparecendo); o dashboard liga essa opção porque
// só quer mostrar atividade "válida" na visão geral.
export async function vendasRecentes(limite = 8, excluirCanceladas = false) {
  return prisma.venda.findMany({
    where: excluirCanceladas ? { status: { not: "CANCELADA" } } : undefined,
    take: limite,
    orderBy: { dataHora: "desc" },
    include: { cliente: true, usuario: true, itens: true },
  });
}

export async function clientesQueMaisCompraram(periodo: PeriodoRelatorio, limite = 5) {
  const inicio = inicioDoPeriodo(periodo);

  const agrupado = await prisma.venda.groupBy({
    by: ["clienteId"],
    where: {
      dataHora: { gte: inicio },
      status: { in: [...STATUS_FATURAMENTO_VALIDO] },
      clienteId: { not: null },
    },
    _sum: { total: true },
    _count: true,
    orderBy: { _sum: { total: "desc" } },
    take: limite,
  });

  const clientes = await prisma.cliente.findMany({
    where: { id: { in: agrupado.map((linha) => linha.clienteId).filter((id): id is string => id !== null) } },
  });
  const clientesPorId = new Map(clientes.map((cliente) => [cliente.id, cliente]));

  return agrupado.map((linha) => ({
    cliente: linha.clienteId ? clientesPorId.get(linha.clienteId) ?? null : null,
    totalGastoCentavos: linha._sum.total ?? 0,
    quantidadeCompras: linha._count,
  }));
}

// Visão geral enxuta: só vendas/faturamento + atividade recente. Lucro, despesas,
// alertas de estoque, mais vendidos e clientes top já têm lugar próprio em /relatorios
// (e nas telas específicas de estoque/despesas) — não duplicar aqui.
export async function resumoDashboard() {
  const [faturamentoDia, faturamentoMes, ticketMedioMes, recentes] = await Promise.all([
    faturamentoPorPeriodo("dia"),
    faturamentoPorPeriodo("mes"),
    ticketMedio("mes"),
    vendasRecentes(8, true),
  ]);

  return { faturamentoDia, faturamentoMes, ticketMedioMes, recentes };
}
