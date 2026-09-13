import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export class ErroEntradaEstoque extends Error {}

export type ItemEntradaEstoqueEntrada = {
  produtoId: string;
  quantidade: number;
  custoUnitario: number; // centavos, sem frete
};

export type DadosEntradaEstoque = {
  fornecedorId?: string | null;
  dataEntrada?: Date;
  itens: ItemEntradaEstoqueEntrada[];
  valorFrete?: number; // centavos
  observacoes?: string | null;
  usuarioId: string;
};

function validarItens(itens: ItemEntradaEstoqueEntrada[]) {
  if (itens.length === 0) {
    throw new ErroEntradaEstoque("Adicione ao menos um produto à entrada.");
  }
  for (const item of itens) {
    if (item.quantidade <= 0) {
      throw new ErroEntradaEstoque("Quantidade inválida em um dos produtos da entrada.");
    }
    if (item.custoUnitario <= 0) {
      throw new ErroEntradaEstoque("Custo unitário inválido em um dos produtos da entrada.");
    }
  }
}

// Rateio uniforme: cada unidade recebe exatamente o mesmo valor de frete, independente
// do produto — regra explícita do dono, diferente do rateio ponderado por valor usado
// em compras.ts::receberPedido (mantido intocado para o fluxo de pedidos).
export function ratearFreteUniforme(itens: { quantidade: number }[], valorFreteCentavos: number): number {
  const quantidadeTotal = itens.reduce((soma, item) => soma + item.quantidade, 0);
  if (valorFreteCentavos <= 0 || quantidadeTotal <= 0) return 0;
  return Math.round(valorFreteCentavos / quantidadeTotal);
}

export async function registrarEntradaEstoque(dados: DadosEntradaEstoque) {
  validarItens(dados.itens);

  const freteRateado = ratearFreteUniforme(dados.itens, dados.valorFrete ?? 0);

  return prisma.$transaction(
    async (tx) => {
      const entrada = await tx.entradaEstoque.create({
        data: {
          fornecedorId: dados.fornecedorId || null,
          dataEntrada: dados.dataEntrada ?? new Date(),
          valorFrete: dados.valorFrete ?? 0,
          observacoes: dados.observacoes?.trim() || null,
          usuarioId: dados.usuarioId,
          itens: {
            create: dados.itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              custoUnitario: item.custoUnitario,
            })),
          },
        },
        include: { itens: true },
      });

      // Lotes de cada item são independentes entre si — criados em paralelo para não
      // multiplicar round-trips ao banco sequencialmente (relevante em conexões
      // via pooler/serverless, onde isso já estourou o timeout padrão da transação).
      const lotes = await Promise.all(
        entrada.itens.map((item) =>
          tx.lote.create({
            data: {
              produtoId: item.produtoId,
              numero: `ENT-${entrada.id.slice(-8)}`,
              dataValidade: null,
              custoUnitario: item.custoUnitario,
              freteRateado,
              custoReal: item.custoUnitario + freteRateado,
              quantidadeInicialVenda: item.quantidade,
              quantidadeAtualVenda: item.quantidade,
              quantidadeInicialDemonstracao: 0,
              quantidadeAtualDemonstracao: 0,
              itemEntradaEstoqueId: item.id,
              status: "ATIVO",
            },
          })
        )
      );

      await Promise.all(
        lotes.map((lote) =>
          tx.movimentacaoEstoque.create({
            data: {
              produtoId: lote.produtoId,
              loteId: lote.id,
              tipo: "ENTRADA_ESTOQUE",
              pool: "VENDA",
              quantidade: lote.quantidadeInicialVenda,
              usuarioId: dados.usuarioId,
              entradaEstoqueId: entrada.id,
            },
          })
        )
      );

      return entrada;
    },
    { timeout: 20000 }
  );
}

export type FiltrosEntradaEstoque = {
  fornecedorId?: string;
  dataInicio?: Date;
  dataFim?: Date;
  pagina?: number;
  porPagina?: number;
};

export async function listarEntradasEstoque(filtros: FiltrosEntradaEstoque = {}) {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const porPagina = filtros.porPagina ?? 20;

  const where: Prisma.EntradaEstoqueWhereInput = {
    ...(filtros.fornecedorId ? { fornecedorId: filtros.fornecedorId } : {}),
    ...(filtros.dataInicio || filtros.dataFim
      ? { dataEntrada: { gte: filtros.dataInicio, lte: filtros.dataFim } }
      : {}),
  };

  const [entradas, total] = await Promise.all([
    prisma.entradaEstoque.findMany({
      where,
      include: { fornecedor: true, usuario: true, itens: { include: { produto: true } } },
      orderBy: { dataEntrada: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.entradaEstoque.count({ where }),
  ]);

  return { entradas, total, pagina, porPagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export async function buscarEntradaEstoquePorId(id: string) {
  return prisma.entradaEstoque.findUnique({
    where: { id },
    include: {
      fornecedor: true,
      usuario: true,
      itens: { include: { produto: true, lote: true } },
    },
  });
}

// Versão para edição: cada item vem com `bloqueado` = já foi vendido a partir do lote
// gerado por ele. Itens bloqueados não podem ter quantidade/custo alterados — só dá
// pra corrigir o que ainda não foi tocado por uma venda.
export async function buscarEntradaEstoqueParaEdicao(id: string) {
  const entrada = await buscarEntradaEstoquePorId(id);
  if (!entrada) return null;

  const itensComStatus = await Promise.all(
    entrada.itens.map(async (item) => {
      const vendas = item.lote ? await prisma.itemVenda.count({ where: { loteId: item.lote.id } }) : 0;
      return { ...item, bloqueado: vendas > 0 };
    })
  );

  return { ...entrada, itens: itensComStatus };
}

export type ItemEntradaEstoqueEdicao = { id: string; quantidade: number; custoUnitario: number };

export type DadosEdicaoEntradaEstoque = {
  fornecedorId?: string | null;
  dataEntrada?: Date;
  observacoes?: string | null;
  valorFrete?: number; // centavos — só pode mudar se nenhum item da entrada já foi vendido
  itens: ItemEntradaEstoqueEdicao[]; // apenas os itens editáveis (não bloqueados) precisam vir aqui
};

// Corrige uma entrada já lançada. Itens já vendidos (algum ItemVenda referencia o lote
// gerado) ficam intocados — nem quantidade, nem custo, nem o frete geral da entrada
// mudam se qualquer item já tiver sido vendido, pra não reescrever custo histórico de
// uma venda que já aconteceu.
export async function atualizarEntradaEstoque(entradaId: string, dados: DadosEdicaoEntradaEstoque) {
  return prisma.$transaction(async (tx) => {
    const entrada = await tx.entradaEstoque.findUnique({
      where: { id: entradaId },
      include: { itens: { include: { lote: true } } },
    });
    if (!entrada) {
      throw new ErroEntradaEstoque("Entrada não encontrada.");
    }

    const idsComVenda = new Set<string>();
    for (const item of entrada.itens) {
      const vendas = item.lote ? await tx.itemVenda.count({ where: { loteId: item.lote.id } }) : 0;
      if (vendas > 0) idsComVenda.add(item.id);
    }

    const freteInformado = dados.valorFrete !== undefined && dados.valorFrete !== entrada.valorFrete;
    if (freteInformado && idsComVenda.size > 0) {
      throw new ErroEntradaEstoque(
        "Não é possível alterar o frete: um ou mais produtos desta entrada já foram vendidos."
      );
    }

    await tx.entradaEstoque.update({
      where: { id: entradaId },
      data: {
        fornecedorId: dados.fornecedorId !== undefined ? dados.fornecedorId || null : undefined,
        dataEntrada: dados.dataEntrada ?? undefined,
        observacoes: dados.observacoes !== undefined ? dados.observacoes?.trim() || null : undefined,
        valorFrete: dados.valorFrete ?? undefined,
      },
    });

    const valorFreteFinal = dados.valorFrete ?? entrada.valorFrete;
    const quantidadesFinais = entrada.itens.map((item) => {
      const editado = dados.itens.find((i) => i.id === item.id);
      return { quantidade: editado && !idsComVenda.has(item.id) ? editado.quantidade : item.quantidade };
    });
    const freteRateado = ratearFreteUniforme(quantidadesFinais, valorFreteFinal);

    for (const item of entrada.itens) {
      const editado = dados.itens.find((i) => i.id === item.id);
      const bloqueado = idsComVenda.has(item.id);

      if (editado && !bloqueado) {
        if (editado.quantidade <= 0) throw new ErroEntradaEstoque("Quantidade inválida em um dos produtos.");
        if (editado.custoUnitario <= 0) throw new ErroEntradaEstoque("Custo unitário inválido em um dos produtos.");

        const deltaQuantidade = editado.quantidade - item.quantidade;

        await tx.itemEntradaEstoque.update({
          where: { id: item.id },
          data: { quantidade: editado.quantidade, custoUnitario: editado.custoUnitario },
        });

        if (item.lote) {
          if (item.lote.quantidadeAtualVenda + deltaQuantidade < 0) {
            throw new ErroEntradaEstoque(
              `A nova quantidade deixaria o estoque negativo para um dos produtos (saldo atual: ${item.lote.quantidadeAtualVenda}).`
            );
          }
          await tx.lote.update({
            where: { id: item.lote.id },
            data: {
              quantidadeInicialVenda: { increment: deltaQuantidade },
              quantidadeAtualVenda: { increment: deltaQuantidade },
              custoUnitario: editado.custoUnitario,
              freteRateado,
              custoReal: editado.custoUnitario + freteRateado,
            },
          });
        }
      } else if (!bloqueado && freteInformado && item.lote) {
        // Item não editado nesta chamada, mas o frete geral mudou — recalcula só o custoReal.
        await tx.lote.update({
          where: { id: item.lote.id },
          data: { freteRateado, custoReal: item.custoUnitario + freteRateado },
        });
      }
    }

    return buscarEntradaEstoquePorId(entradaId);
  });
}
