import { prisma } from "./db";
import { gerarOcorrenciasPendentes } from "./despesas";

export type IndicadoresDespesas = {
  total: number;
  totalCentavos: number;
  pagas: number;
  pagasCentavos: number;
  pendentes: number;
  pendentesCentavos: number;
  vencidas: number;
  vencidasCentavos: number;
  fixasCentavos: number;
  variaveisCentavos: number;
  mediaMensalCentavos: number;
  maiorCategoria: { nome: string; totalCentavos: number } | null;
};

// Considera despesas por dataDespesa (regime de competência) no período informado —
// consistente com o mesmo regime usado por padrão no relatório de lucro.
export async function indicadoresDespesas(periodo: { inicio: Date; fim: Date }): Promise<IndicadoresDespesas> {
  await gerarOcorrenciasPendentes();
  const hoje = new Date();

  const despesas = await prisma.despesa.findMany({
    where: { ativo: true, dataDespesa: { gte: periodo.inicio, lte: periodo.fim }, status: { not: "CANCELADO" } },
    include: { categoria: true },
  });

  let totalCentavos = 0;
  let pagasCentavos = 0;
  let pendentesCentavos = 0;
  let vencidasCentavos = 0;
  let fixasCentavos = 0;
  let variaveisCentavos = 0;
  let pagas = 0;
  let pendentes = 0;
  let vencidas = 0;
  const porCategoria = new Map<string, number>();

  for (const despesa of despesas) {
    totalCentavos += despesa.valor;
    if (despesa.classificacao === "FIXA") fixasCentavos += despesa.valor;
    if (despesa.classificacao === "VARIAVEL") variaveisCentavos += despesa.valor;

    if (despesa.status === "PAGO") {
      pagasCentavos += despesa.valor;
      pagas++;
    } else if (despesa.vencimento && despesa.vencimento < hoje) {
      vencidasCentavos += despesa.valor;
      vencidas++;
    } else {
      pendentesCentavos += despesa.valor;
      pendentes++;
    }

    porCategoria.set(despesa.categoria.nome, (porCategoria.get(despesa.categoria.nome) ?? 0) + despesa.valor);
  }

  const diasNoPeriodo = Math.max(1, Math.round((periodo.fim.getTime() - periodo.inicio.getTime()) / (1000 * 60 * 60 * 24)));
  const mediaMensalCentavos = Math.round((totalCentavos / diasNoPeriodo) * 30);

  let maiorCategoria: { nome: string; totalCentavos: number } | null = null;
  for (const [nome, valor] of porCategoria.entries()) {
    if (!maiorCategoria || valor > maiorCategoria.totalCentavos) maiorCategoria = { nome, totalCentavos: valor };
  }

  return {
    total: despesas.length,
    totalCentavos,
    pagas,
    pagasCentavos,
    pendentes,
    pendentesCentavos,
    vencidas,
    vencidasCentavos,
    fixasCentavos,
    variaveisCentavos,
    mediaMensalCentavos,
    maiorCategoria,
  };
}

export type DespesasPorCategoria = { categoria: string; totalCentavos: number };

export async function despesasPorCategoria(periodo: { inicio: Date; fim: Date }): Promise<DespesasPorCategoria[]> {
  const linhas = await despesasAgrupadas(periodo, "categoria");
  return linhas.map((linha) => ({ categoria: linha.label, totalCentavos: linha.totalCentavos }));
}

export type AgrupamentoDespesas = "categoria" | "status" | "formaPagamento" | "recorrencia" | "usuario" | "mes";
export type LinhaDespesasAgrupadas = { label: string; totalCentavos: number; quantidade: number };

const LABEL_FORMA_PAGAMENTO_DESPESA: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_DEBITO: "Cartão de débito",
  CARTAO_CREDITO: "Cartão de crédito",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
  OUTRO: "Outro",
};

const LABEL_STATUS_DESPESA: Record<string, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

const LABEL_RECORRENCIA: Record<string, string> = {
  NENHUMA: "Nenhuma",
  SEMANAL: "Semanal",
  MENSAL: "Mensal",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

export async function despesasAgrupadas(periodo: { inicio: Date; fim: Date }, agrupamento: AgrupamentoDespesas): Promise<LinhaDespesasAgrupadas[]> {
  const despesas = await prisma.despesa.findMany({
    where: { ativo: true, dataDespesa: { gte: periodo.inicio, lte: periodo.fim }, status: { not: "CANCELADO" } },
    include: { categoria: true, usuario: true },
  });

  const mapa = new Map<string, LinhaDespesasAgrupadas>();
  for (const despesa of despesas) {
    let label: string;
    if (agrupamento === "categoria") label = despesa.categoria.nome;
    else if (agrupamento === "status") label = LABEL_STATUS_DESPESA[despesa.status];
    else if (agrupamento === "formaPagamento") label = despesa.formaPagamento ? LABEL_FORMA_PAGAMENTO_DESPESA[despesa.formaPagamento] : "Não definida";
    else if (agrupamento === "recorrencia") label = LABEL_RECORRENCIA[despesa.recorrencia];
    else if (agrupamento === "usuario") label = despesa.usuario.nome;
    else label = despesa.dataDespesa.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    const atual = mapa.get(label) ?? { label, totalCentavos: 0, quantidade: 0 };
    atual.totalCentavos += despesa.valor;
    atual.quantidade += 1;
    mapa.set(label, atual);
  }

  return Array.from(mapa.values()).sort((a, b) => b.totalCentavos - a.totalCentavos);
}

// Duração do período anterior de mesmo tamanho, imediatamente antes do período informado —
// usado para a comparação "vs. período anterior".
export function periodoAnterior(periodo: { inicio: Date; fim: Date }): { inicio: Date; fim: Date } {
  const duracaoMs = periodo.fim.getTime() - periodo.inicio.getTime();
  return {
    inicio: new Date(periodo.inicio.getTime() - duracaoMs - 1),
    fim: new Date(periodo.inicio.getTime() - 1),
  };
}
