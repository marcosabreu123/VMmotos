import { prisma } from "./db";
import type { Prisma, TipoMovimentacao } from "@prisma/client";

export class ErroEstoque extends Error {}

export const LABEL_TIPO_MOVIMENTACAO: Record<TipoMovimentacao, string> = {
  ENTRADA_COMPRA: "Entrada (pedido)",
  ENTRADA_MANUAL: "Entrada manual",
  ENTRADA_ESTOQUE: "Entrada de estoque",
  SAIDA_VENDA: "Saída (venda)",
  SAIDA_DEMONSTRACAO: "Saída (demonstracao)",
  TRANSFERENCIA_DEMONSTRACAO: "Transferência de demonstracao",
  AJUSTE_POSITIVO: "Ajuste positivo",
  AJUSTE_NEGATIVO: "Ajuste negativo",
  PERDA_VENCIMENTO: "Perda por vencimento",
  PERDA_DEFEITO: "Baixa por defeito",
  BRINDE: "Baixa (brinde/amostra grátis)",
  DEVOLUCAO: "Devolução",
  ESTORNO_CANCELAMENTO: "Estorno (cancelamento)",
};

export type StatusValidade = "vencido" | "vence_em_breve" | "ok" | "sem_validade";

const DIAS_VENCE_EM_BREVE = 60;

export function statusValidadeLote(dataValidade: Date | null, agora: Date = new Date()): StatusValidade {
  if (!dataValidade) return "sem_validade";
  const dias = Math.floor((dataValidade.getTime() - agora.getTime()) / 86_400_000);
  if (dias < 0) return "vencido";
  if (dias <= DIAS_VENCE_EM_BREVE) return "vence_em_breve";
  return "ok";
}

export type DadosEntradaManual = {
  produtoId: string;
  quantidade: number;
  custoUnitario: number; // centavos
  numeroLote: string;
  dataValidade: Date | null;
  observacao: string | null;
  usuarioId: string;
};

// Entrada rápida sem passar por um Pedido de Compra formal — destrava vendas
// antes do fluxo completo de rateio de frete (Fase 2.x) existir.
export async function entradaManual(dados: DadosEntradaManual) {
  return prisma.$transaction(async (tx) => {
    const lote = await tx.lote.create({
      data: {
        produtoId: dados.produtoId,
        numero: dados.numeroLote,
        dataValidade: dados.dataValidade,
        custoUnitario: dados.custoUnitario,
        freteRateado: 0,
        custoReal: dados.custoUnitario,
        quantidadeInicialVenda: dados.quantidade,
        quantidadeAtualVenda: dados.quantidade,
        quantidadeInicialDemonstracao: 0,
        quantidadeAtualDemonstracao: 0,
      },
    });

    await tx.movimentacaoEstoque.create({
      data: {
        produtoId: dados.produtoId,
        loteId: lote.id,
        tipo: "ENTRADA_MANUAL",
        pool: "VENDA",
        quantidade: dados.quantidade,
        usuarioId: dados.usuarioId,
        observacao: dados.observacao,
      },
    });

    return lote;
  });
}

export async function listarMovimentacoes(limite = 100) {
  return prisma.movimentacaoEstoque.findMany({
    take: limite,
    orderBy: { createdAt: "desc" },
    include: { produto: true, usuario: true },
  });
}

export async function produtosAbaixoDoMinimo() {
  const produtos = await prisma.produto.findMany({
    where: { ativo: true },
    include: { lotes: { where: { status: "ATIVO" } } },
  });

  return produtos
    .map((produto) => {
      const estoqueAtual = produto.lotes.reduce((soma, lote) => soma + lote.quantidadeAtualVenda, 0);
      return { produto, estoqueAtual };
    })
    .filter(({ estoqueAtual, produto }) => estoqueAtual <= produto.estoqueMinimo);
}

export async function produtosSemEstoque() {
  const abaixoDoMinimo = await produtosAbaixoDoMinimo();
  return abaixoDoMinimo.filter(({ estoqueAtual }) => estoqueAtual <= 0);
}

// Lotes com validade nos próximos `dias` (padrão 60), ainda ativos e com saldo — usado
// nos alertas do dashboard. Não bloqueia venda (isso é resolvido por FEFO em vendas.ts).
export async function lotesValidadeProxima(dias = 60) {
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);

  return prisma.lote.findMany({
    where: {
      status: "ATIVO",
      quantidadeAtualVenda: { gt: 0 },
      dataValidade: { not: null, lte: limite },
    },
    include: { produto: true },
    orderBy: { dataValidade: "asc" },
  });
}

// ---------- Gestão de lote (status, demonstracao, ajustes) ----------

export async function listarLotesGerenciaveis() {
  return prisma.lote.findMany({
    where: { status: { in: ["ATIVO", "BLOQUEADO"] } },
    include: { produto: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function buscarLotePorId(loteId: string) {
  return prisma.lote.findUnique({
    where: { id: loteId },
    include: {
      produto: true,
      movimentacoes: { include: { usuario: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function alterarStatusLote(loteId: string, status: "ATIVO" | "BLOQUEADO") {
  const lote = await prisma.lote.findUnique({ where: { id: loteId } });
  if (!lote) throw new ErroEstoque("Lote não encontrado.");
  return prisma.lote.update({ where: { id: loteId }, data: { status } });
}

export type SentidoTransferencia = "VENDA_PARA_DEMONSTRACAO" | "DEMONSTRACAO_PARA_VENDA";

async function transferirEstoqueTx(
  tx: Prisma.TransactionClient,
  params: {
    loteId: string;
    sentido: SentidoTransferencia;
    quantidade: number;
    usuarioId: string;
    observacao?: string | null;
  }
) {
  if (params.quantidade <= 0) {
    throw new ErroEstoque("Quantidade inválida.");
  }

  const lote = await tx.lote.findUnique({ where: { id: params.loteId } });
  if (!lote) throw new ErroEstoque("Lote não encontrado.");

  const paraDemonstracao = params.sentido === "VENDA_PARA_DEMONSTRACAO";
  const origem = paraDemonstracao ? lote.quantidadeAtualVenda : lote.quantidadeAtualDemonstracao;

  if (origem < params.quantidade) {
    throw new ErroEstoque("Saldo insuficiente no pool de origem para essa transferência.");
  }

  await tx.lote.update({
    where: { id: lote.id },
    data: paraDemonstracao
      ? {
          quantidadeAtualVenda: { decrement: params.quantidade },
          quantidadeAtualDemonstracao: { increment: params.quantidade },
        }
      : {
          quantidadeAtualDemonstracao: { decrement: params.quantidade },
          quantidadeAtualVenda: { increment: params.quantidade },
        },
  });

  await tx.movimentacaoEstoque.create({
    data: {
      produtoId: lote.produtoId,
      loteId: lote.id,
      tipo: "TRANSFERENCIA_DEMONSTRACAO",
      pool: paraDemonstracao ? "DEMONSTRACAO" : "VENDA",
      quantidade: params.quantidade,
      usuarioId: params.usuarioId,
      observacao: params.observacao ?? null,
    },
  });

  return lote;
}

export async function transferirEstoque(params: {
  loteId: string;
  sentido: SentidoTransferencia;
  quantidade: number;
  usuarioId: string;
  observacao?: string | null;
}) {
  return prisma.$transaction((tx) => transferirEstoqueTx(tx, params));
}

async function registrarSaidaDemonstracaoTx(
  tx: Prisma.TransactionClient,
  params: { loteId: string; quantidade: number; motivo: string; usuarioId: string }
) {
  const motivo = params.motivo.trim();
  if (!motivo) throw new ErroEstoque("Informe o motivo da saída de demonstracao.");
  if (params.quantidade <= 0) throw new ErroEstoque("Quantidade inválida.");

  const lote = await tx.lote.findUnique({ where: { id: params.loteId } });
  if (!lote) throw new ErroEstoque("Lote não encontrado.");
  if (lote.quantidadeAtualDemonstracao < params.quantidade) {
    throw new ErroEstoque("Saldo de demonstracao insuficiente.");
  }

  await tx.lote.update({
    where: { id: lote.id },
    data: { quantidadeAtualDemonstracao: { decrement: params.quantidade } },
  });

  await tx.movimentacaoEstoque.create({
    data: {
      produtoId: lote.produtoId,
      loteId: lote.id,
      tipo: "SAIDA_DEMONSTRACAO",
      pool: "DEMONSTRACAO",
      quantidade: params.quantidade,
      usuarioId: params.usuarioId,
      observacao: motivo,
    },
  });

  return lote;
}

export async function registrarSaidaDemonstracao(params: {
  loteId: string;
  quantidade: number;
  motivo: string;
  usuarioId: string;
}) {
  return prisma.$transaction((tx) => registrarSaidaDemonstracaoTx(tx, params));
}

// Resolve qual Lote uma ação "por produto" (sem escolher lote na UI) deve afetar —
// mesma prioridade do FEFO de vendas (validade mais próxima, senão mais antigo por
// criação), para o comportamento ficar previsível mesmo com lotes legados múltiplos.
export async function resolverLoteAlvo(
  tx: Prisma.TransactionClient,
  produtoId: string,
  pool: "VENDA" | "DEMONSTRACAO",
  quantidadeMinima = 0
) {
  const filtroQuantidade =
    pool === "VENDA"
      ? { quantidadeAtualVenda: { gte: quantidadeMinima } }
      : { quantidadeAtualDemonstracao: { gte: quantidadeMinima } };

  const comValidade = await tx.lote.findFirst({
    where: { produtoId, status: "ATIVO", dataValidade: { not: null }, ...filtroQuantidade },
    orderBy: { dataValidade: "asc" },
  });
  if (comValidade) return comValidade;

  const semValidade = await tx.lote.findFirst({
    where: { produtoId, status: "ATIVO", dataValidade: null, ...filtroQuantidade },
    orderBy: { createdAt: "asc" },
  });
  if (semValidade) return semValidade;

  throw new ErroEstoque(
    quantidadeMinima > 0
      ? "Saldo insuficiente em um único lote para essa operação — verifique a quantidade ou dê entrada de estoque."
      : "Nenhum lote ativo encontrado para este produto — dê entrada de estoque primeiro."
  );
}

export async function transferirParaDemonstracaoPorProduto(params: {
  produtoId: string;
  sentido: SentidoTransferencia;
  quantidade: number;
  usuarioId: string;
  observacao?: string | null;
}) {
  if (params.quantidade <= 0) throw new ErroEstoque("Quantidade inválida.");

  return prisma.$transaction(async (tx) => {
    const pool = params.sentido === "VENDA_PARA_DEMONSTRACAO" ? "VENDA" : "DEMONSTRACAO";
    const lote = await resolverLoteAlvo(tx, params.produtoId, pool, params.quantidade);
    return transferirEstoqueTx(tx, {
      loteId: lote.id,
      sentido: params.sentido,
      quantidade: params.quantidade,
      usuarioId: params.usuarioId,
      observacao: params.observacao,
    });
  });
}

export async function registrarSaidaDemonstracaoPorProduto(params: {
  produtoId: string;
  quantidade: number;
  motivo: string;
  usuarioId: string;
}) {
  if (params.quantidade <= 0) throw new ErroEstoque("Quantidade inválida.");

  return prisma.$transaction(async (tx) => {
    const lote = await resolverLoteAlvo(tx, params.produtoId, "DEMONSTRACAO", params.quantidade);
    return registrarSaidaDemonstracaoTx(tx, {
      loteId: lote.id,
      quantidade: params.quantidade,
      motivo: params.motivo,
      usuarioId: params.usuarioId,
    });
  });
}

export type TipoAjuste = "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO" | "PERDA_VENCIMENTO" | "PERDA_DEFEITO" | "BRINDE";

export type DadosAjuste = {
  loteId: string;
  pool: "VENDA" | "DEMONSTRACAO";
  tipo: TipoAjuste;
  quantidade: number;
  motivo: string;
  usuarioId: string;
};

async function ajustarEstoqueTx(tx: Prisma.TransactionClient, dados: DadosAjuste) {
  const motivo = dados.motivo.trim();
  if (!motivo) throw new ErroEstoque("Informe o motivo do ajuste.");
  if (dados.quantidade <= 0) throw new ErroEstoque("Quantidade inválida.");

  const lote = await tx.lote.findUnique({ where: { id: dados.loteId } });
  if (!lote) throw new ErroEstoque("Lote não encontrado.");

  const ehVenda = dados.pool === "VENDA";
  const atual = ehVenda ? lote.quantidadeAtualVenda : lote.quantidadeAtualDemonstracao;
  const ehPositivo = dados.tipo === "AJUSTE_POSITIVO";

  if (!ehPositivo && atual < dados.quantidade) {
    throw new ErroEstoque("Ajuste deixaria o estoque negativo — não permitido.");
  }

  const delta = ehPositivo ? { increment: dados.quantidade } : { decrement: dados.quantidade };
  await tx.lote.update({
    where: { id: lote.id },
    data: ehVenda ? { quantidadeAtualVenda: delta } : { quantidadeAtualDemonstracao: delta },
  });

  await tx.movimentacaoEstoque.create({
    data: {
      produtoId: lote.produtoId,
      loteId: lote.id,
      tipo: dados.tipo,
      pool: dados.pool,
      quantidade: dados.quantidade,
      usuarioId: dados.usuarioId,
      observacao: motivo,
    },
  });
}

export async function ajustarEstoque(dados: DadosAjuste) {
  return prisma.$transaction((tx) => ajustarEstoqueTx(tx, dados));
}

export async function ajustarEstoquePorProduto(dados: {
  produtoId: string;
  pool: "VENDA" | "DEMONSTRACAO";
  tipo: TipoAjuste;
  quantidade: number;
  motivo: string;
  usuarioId: string;
}) {
  if (dados.quantidade <= 0) throw new ErroEstoque("Quantidade inválida.");

  return prisma.$transaction(async (tx) => {
    const quantidadeMinima = dados.tipo === "AJUSTE_POSITIVO" ? 0 : dados.quantidade;
    const lote = await resolverLoteAlvo(tx, dados.produtoId, dados.pool, quantidadeMinima);
    return ajustarEstoqueTx(tx, {
      loteId: lote.id,
      pool: dados.pool,
      tipo: dados.tipo,
      quantidade: dados.quantidade,
      motivo: dados.motivo,
      usuarioId: dados.usuarioId,
    });
  });
}

// ---------- Visão por produto (Entrada de Estoque / tela simplificada) ----------

export async function listarVisaoEstoque() {
  const produtos = await prisma.produto.findMany({
    where: { ativo: true },
    include: { fornecedor: true, lotes: { where: { status: "ATIVO" } } },
    orderBy: { nome: "asc" },
  });

  return produtos.map((produto) => {
    const quantidadeAtual = produto.lotes.reduce((soma, lote) => soma + lote.quantidadeAtualVenda, 0);
    const quantidadeDemonstracao = produto.lotes.reduce((soma, lote) => soma + lote.quantidadeAtualDemonstracao, 0);
    const somaCusto = produto.lotes.reduce((soma, lote) => soma + lote.custoReal * lote.quantidadeAtualVenda, 0);
    const custoMedio = quantidadeAtual > 0 ? Math.round(somaCusto / quantidadeAtual) : 0;

    const status: "sem_estoque" | "baixo" | "ok" =
      quantidadeAtual <= 0 ? "sem_estoque" : quantidadeAtual <= produto.estoqueMinimo ? "baixo" : "ok";

    return { produto, quantidadeAtual, quantidadeDemonstracao, custoMedio, status };
  });
}

// Quanto está "parado" no estoque hoje: custo (dinheiro já investido) vs. venda
// projetada sem desconto (o que renderia se tudo vendesse pelo preço cheio) — a
// diferença é o lucro que ainda está preso em prateleira, não realizado.
export async function valorEstoqueAtual() {
  const lotes = await prisma.lote.findMany({
    where: { status: "ATIVO", quantidadeAtualVenda: { gt: 0 }, produto: { ativo: true } },
    select: {
      produtoId: true,
      quantidadeAtualVenda: true,
      custoReal: true,
      produto: { select: { precoVenda: true } },
    },
  });

  const produtosComEstoque = new Set(lotes.map((lote) => lote.produtoId));
  const unidadesTotais = lotes.reduce((soma, lote) => soma + lote.quantidadeAtualVenda, 0);
  const valorCustoTotal = lotes.reduce((soma, lote) => soma + lote.custoReal * lote.quantidadeAtualVenda, 0);
  const valorVendaProjetado = lotes.reduce(
    (soma, lote) => soma + lote.produto.precoVenda * lote.quantidadeAtualVenda,
    0
  );
  const lucroFuturoPotencial = valorVendaProjetado - valorCustoTotal;

  return {
    produtosComEstoque: produtosComEstoque.size,
    unidadesTotais,
    valorCustoTotal,
    valorVendaProjetado,
    lucroFuturoPotencial,
    margemPotencial: valorVendaProjetado > 0 ? (lucroFuturoPotencial / valorVendaProjetado) * 100 : 0,
  };
}

export async function listarMovimentacoesPorProduto(produtoId: string, limite = 200) {
  return prisma.movimentacaoEstoque.findMany({
    where: { produtoId },
    include: { usuario: true },
    orderBy: { createdAt: "desc" },
    take: limite,
  });
}

// ---------- Inventário / contagem ----------

export async function listarLotesParaContagem() {
  return prisma.lote.findMany({
    where: { status: "ATIVO" },
    include: { produto: true },
    orderBy: { produto: { nome: "asc" } },
  });
}

export type ItemContagem = { loteId: string; pool: "VENDA" | "DEMONSTRACAO"; quantidadeContada: number };

export async function aplicarContagemInventario(params: { itens: ItemContagem[]; usuarioId: string }) {
  if (params.itens.length === 0) {
    throw new ErroEstoque("Nenhuma contagem para aplicar.");
  }

  return prisma.$transaction(async (tx) => {
    const resultados: Array<{ loteId: string; pool: "VENDA" | "DEMONSTRACAO"; delta: number }> = [];

    for (const item of params.itens) {
      const lote = await tx.lote.findUnique({ where: { id: item.loteId } });
      if (!lote) throw new ErroEstoque("Lote não encontrado durante a contagem.");

      const atual = item.pool === "VENDA" ? lote.quantidadeAtualVenda : lote.quantidadeAtualDemonstracao;
      const delta = item.quantidadeContada - atual;
      if (delta === 0) continue;

      await ajustarEstoqueTx(tx, {
        loteId: item.loteId,
        pool: item.pool,
        tipo: delta > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO",
        quantidade: Math.abs(delta),
        motivo: "Contagem de inventário",
        usuarioId: params.usuarioId,
      });

      resultados.push({ loteId: item.loteId, pool: item.pool, delta });
    }

    return resultados;
  });
}
