import { prisma } from "./db";

// Margem por custo real e curva ABC ficam para a Fase 2.x, quando o rateio de
// frete (lib/pedidos.ts) existir de fato — por ora ItemVenda já grava o
// snapshot de custoReal, então o relatório de margem só precisa ser escrito
// depois, sem mexer no schema.

export type PeriodoRelatorio = "dia" | "semana" | "mes";

export function inicioDoPeriodo(periodo: PeriodoRelatorio, referencia = new Date()): Date {
  const data = new Date(referencia);
  data.setHours(0, 0, 0, 0);

  if (periodo === "dia") return data;

  if (periodo === "semana") {
    const diaDaSemana = data.getDay();
    data.setDate(data.getDate() - diaDaSemana);
    return data;
  }

  data.setDate(1);
  return data;
}

export async function faturamentoPorPeriodo(periodo: PeriodoRelatorio) {
  const inicio = inicioDoPeriodo(periodo);

  const resultado = await prisma.venda.aggregate({
    where: { status: "CONCLUIDA", dataHora: { gte: inicio } },
    _sum: { total: true },
    _count: true,
  });

  return {
    periodo,
    inicio,
    totalCentavos: resultado._sum.total ?? 0,
    quantidadeVendas: resultado._count,
  };
}

export async function maisVendidos(limite = 10) {
  const agrupado = await prisma.itemVenda.groupBy({
    by: ["produtoId"],
    _sum: { quantidade: true, subtotalItem: true },
    orderBy: { _sum: { quantidade: "desc" } },
    take: limite,
  });

  const produtos = await prisma.produto.findMany({
    where: { id: { in: agrupado.map((linha) => linha.produtoId) } },
  });
  const produtosPorId = new Map(produtos.map((produto) => [produto.id, produto]));

  return agrupado.map((linha) => ({
    produto: produtosPorId.get(linha.produtoId) ?? null,
    quantidadeVendida: linha._sum.quantidade ?? 0,
    receitaCentavos: linha._sum.subtotalItem ?? 0,
  }));
}
