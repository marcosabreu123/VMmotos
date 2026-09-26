import { prisma } from "./db";

/** A loja fica em São Paulo; o servidor da Vercel roda em UTC. Todo corte de
    dia precisa usar o fuso da loja, senão venda da noite cai no dia errado. */
export const FUSO_LOJA = "America/Sao_Paulo";

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

// ---------- Faturamento dia a dia (gráfico da tela de Vendas) ----------

// Tipos e contas puras vivem em lib/faturamento-grafico.ts, sem Prisma junto,
// porque o componente do gráfico roda no navegador. Reexportados aqui para
// quem já consome este módulo.
import type { PontoFaturamento } from "./faturamento-grafico";
export type { PeriodoGrafico, PontoFaturamento } from "./faturamento-grafico";
export { DIAS_DO_PERIODO, recortarPeriodo } from "./faturamento-grafico";

/** O dia de hoje no fuso da loja, como "YYYY-MM-DD". */
function hojeNaLoja(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_LOJA }).format(new Date());
}

function somarDias(dia: string, quantidade: number): string {
  const [ano, mes, data] = dia.split("-").map(Number);
  // UTC de propósito: aqui a data é só um rótulo de calendário, e fazer a
  // conta em UTC evita que o horário de verão do servidor pule um dia.
  const d = new Date(Date.UTC(ano, mes - 1, data));
  d.setUTCDate(d.getUTCDate() + quantidade);
  return d.toISOString().slice(0, 10);
}

/**
 * Faturamento de cada dia, para o gráfico.
 *
 * Dois cuidados que decidem se o número bate com o resto da tela:
 *
 * 1. O dia é o da LOJA, não o do servidor. A coluna guarda UTC e a Vercel roda
 *    em UTC; sem converter, uma venda das 21h30 cairia no dia seguinte.
 * 2. Dia sem venda entra com zero. Sem isso a linha ligaria um dia ao outro por
 *    cima do buraco, mostrando movimento onde a loja ficou fechada.
 *
 * O filtro de status é o mesmo de `faturamentoPorPeriodo` de propósito: o
 * gráfico fica logo abaixo daqueles quadros e os totais precisam fechar.
 */
export async function faturamentoDiario(): Promise<PontoFaturamento[]> {
  const hoje = hojeNaLoja();

  const linhas = await prisma.$queryRaw<Array<{ dia: string; total: bigint; vendas: bigint }>>`
    SELECT to_char(("dataHora" AT TIME ZONE 'UTC' AT TIME ZONE ${FUSO_LOJA})::date, 'YYYY-MM-DD') AS dia,
           COALESCE(SUM(total), 0)::bigint AS total,
           COUNT(*)::bigint AS vendas
    FROM "Venda"
    WHERE status = 'CONCLUIDA'
    GROUP BY 1
    ORDER BY 1
  `;

  const porDia = new Map(linhas.map((l) => [l.dia, { total: Number(l.total), vendas: Number(l.vendas) }]));

  // Começa na primeira venda e vai até hoje, sem buraco: dia fechado entra
  // com zero para a linha não pular por cima dele.
  const inicio = linhas[0]?.dia ?? hoje;

  const pontos: PontoFaturamento[] = [];
  for (let dia = inicio; dia <= hoje; dia = somarDias(dia, 1)) {
    const achado = porDia.get(dia);
    pontos.push({ dia, totalCentavos: achado?.total ?? 0, vendas: achado?.vendas ?? 0 });
  }

  return pontos;
}
