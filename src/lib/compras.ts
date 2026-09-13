import { prisma } from "./db";
import type { StatusPedido, Prisma } from "@prisma/client";

export class ErroCompra extends Error {}

export type ItemPedidoEntrada = {
  produtoId: string;
  quantidade: number;
  quantidadeDemonstracao?: number;
  custoUnitario: number; // centavos, sem frete
};

export type DadosPedido = {
  fornecedorId: string;
  itens: ItemPedidoEntrada[];
  valorFrete?: number; // centavos
  observacoes?: string | null;
};

function validarItens(itens: ItemPedidoEntrada[]) {
  if (itens.length === 0) {
    throw new ErroCompra("Adicione ao menos um item ao pedido.");
  }
  for (const item of itens) {
    if (item.quantidade <= 0) {
      throw new ErroCompra("Quantidade inválida em um dos itens do pedido.");
    }
    if (item.custoUnitario <= 0) {
      throw new ErroCompra("Custo unitário inválido em um dos itens do pedido.");
    }
  }
}

export async function criarPedido(dados: DadosPedido) {
  validarItens(dados.itens);

  return prisma.pedidoDeCompra.create({
    data: {
      fornecedorId: dados.fornecedorId,
      valorFrete: dados.valorFrete ?? 0,
      observacoes: dados.observacoes?.trim() || null,
      itens: {
        create: dados.itens.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          quantidadeDemonstracao: item.quantidadeDemonstracao ?? 0,
          custoUnitario: item.custoUnitario,
        })),
      },
    },
    include: { itens: true },
  });
}

export async function atualizarPedido(id: string, dados: DadosPedido) {
  validarItens(dados.itens);

  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedidoDeCompra.findUnique({ where: { id } });
    if (!pedido) {
      throw new ErroCompra("Pedido não encontrado.");
    }
    if (pedido.status !== "RASCUNHO") {
      throw new ErroCompra("Só é possível editar pedidos em rascunho.");
    }

    await tx.itemPedidoDeCompra.deleteMany({ where: { pedidoCompraId: id } });

    return tx.pedidoDeCompra.update({
      where: { id },
      data: {
        fornecedorId: dados.fornecedorId,
        valorFrete: dados.valorFrete ?? 0,
        observacoes: dados.observacoes?.trim() || null,
        itens: {
          create: dados.itens.map((item) => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            quantidadeDemonstracao: item.quantidadeDemonstracao ?? 0,
            custoUnitario: item.custoUnitario,
          })),
        },
      },
      include: { itens: true },
    });
  });
}

export async function enviarPedido(id: string) {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedidoDeCompra.findUnique({ where: { id } });
    if (!pedido) {
      throw new ErroCompra("Pedido não encontrado.");
    }
    if (pedido.status !== "RASCUNHO") {
      throw new ErroCompra('Só é possível enviar pedidos em rascunho.');
    }
    return tx.pedidoDeCompra.update({ where: { id }, data: { status: "ENVIADO" } });
  });
}

export async function cancelarPedido(id: string) {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedidoDeCompra.findUnique({ where: { id } });
    if (!pedido) {
      throw new ErroCompra("Pedido não encontrado.");
    }
    if (pedido.status === "RECEBIDO") {
      throw new ErroCompra("Um pedido já recebido não pode ser cancelado.");
    }
    if (pedido.status === "CANCELADO") {
      throw new ErroCompra("Este pedido já foi cancelado.");
    }
    return tx.pedidoDeCompra.update({ where: { id }, data: { status: "CANCELADO" } });
  });
}

export type DadosRecebimentoItem = {
  itemPedidoId: string;
  numeroLote: string;
  dataValidade?: Date | null;
};

// Rateio de frete proporcional ao valor de custo de cada item (custoUnitario * quantidade total do item),
// com correção de arredondamento no último item para que a soma bata exatamente com o valor de frete informado.
export async function receberPedido(params: {
  pedidoId: string;
  usuarioId: string;
  itens: DadosRecebimentoItem[];
}) {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedidoDeCompra.findUnique({
      where: { id: params.pedidoId },
      include: { itens: true },
    });
    if (!pedido) {
      throw new ErroCompra("Pedido não encontrado.");
    }
    if (pedido.status !== "ENVIADO") {
      throw new ErroCompra('Só é possível receber pedidos com status "Enviado".');
    }
    if (params.itens.length !== pedido.itens.length) {
      throw new ErroCompra("Informe o lote de recebimento para todos os itens do pedido.");
    }

    const basePorItem = new Map(
      pedido.itens.map((item) => [item.id, item.custoUnitario * (item.quantidade + item.quantidadeDemonstracao)])
    );
    const baseTotal = [...basePorItem.values()].reduce((soma, valor) => soma + valor, 0);

    const freteTotalPorItem = new Map<string, number>();
    if (pedido.valorFrete > 0 && baseTotal > 0) {
      let freteDistribuido = 0;
      pedido.itens.forEach((item, indice) => {
        const ehUltimo = indice === pedido.itens.length - 1;
        const base = basePorItem.get(item.id) ?? 0;
        const frete = ehUltimo ? pedido.valorFrete - freteDistribuido : Math.round((pedido.valorFrete * base) / baseTotal);
        freteDistribuido += frete;
        freteTotalPorItem.set(item.id, frete);
      });
    } else {
      pedido.itens.forEach((item) => freteTotalPorItem.set(item.id, 0));
    }

    for (const itemPedido of pedido.itens) {
      const recebimento = params.itens.find((item) => item.itemPedidoId === itemPedido.id);
      if (!recebimento || !recebimento.numeroLote.trim()) {
        throw new ErroCompra("Informe o número do lote para cada item recebido.");
      }

      const quantidadeTotal = itemPedido.quantidade + itemPedido.quantidadeDemonstracao;
      const freteItemTotal = freteTotalPorItem.get(itemPedido.id) ?? 0;
      const freteRateado = quantidadeTotal > 0 ? Math.round(freteItemTotal / quantidadeTotal) : 0;
      const custoReal = itemPedido.custoUnitario + freteRateado;

      const lote = await tx.lote.create({
        data: {
          produtoId: itemPedido.produtoId,
          numero: recebimento.numeroLote.trim(),
          dataValidade: recebimento.dataValidade ?? null,
          custoUnitario: itemPedido.custoUnitario,
          freteRateado,
          custoReal,
          quantidadeInicialVenda: itemPedido.quantidade,
          quantidadeAtualVenda: itemPedido.quantidade,
          quantidadeInicialDemonstracao: itemPedido.quantidadeDemonstracao,
          quantidadeAtualDemonstracao: itemPedido.quantidadeDemonstracao,
          itemPedidoId: itemPedido.id,
          status: "ATIVO",
        },
      });

      if (itemPedido.quantidade > 0) {
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: itemPedido.produtoId,
            loteId: lote.id,
            tipo: "ENTRADA_COMPRA",
            pool: "VENDA",
            quantidade: itemPedido.quantidade,
            usuarioId: params.usuarioId,
            pedidoCompraId: pedido.id,
          },
        });
      }

      if (itemPedido.quantidadeDemonstracao > 0) {
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: itemPedido.produtoId,
            loteId: lote.id,
            tipo: "ENTRADA_COMPRA",
            pool: "DEMONSTRACAO",
            quantidade: itemPedido.quantidadeDemonstracao,
            usuarioId: params.usuarioId,
            pedidoCompraId: pedido.id,
          },
        });
      }
    }

    return tx.pedidoDeCompra.update({
      where: { id: pedido.id },
      data: { status: "RECEBIDO", dataRecebimento: new Date() },
    });
  });
}

export async function buscarPedidoPorId(id: string) {
  return prisma.pedidoDeCompra.findUnique({
    where: { id },
    include: {
      fornecedor: true,
      itens: { include: { produto: true, lote: true } },
      movimentacoes: { include: { usuario: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export type FiltrosPedidos = {
  status?: StatusPedido;
  fornecedorId?: string;
  dataInicio?: Date;
  dataFim?: Date;
  busca?: string;
  pagina?: number;
  porPagina?: number;
};

export async function listarPedidos(filtros: FiltrosPedidos = {}) {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const porPagina = filtros.porPagina ?? 20;
  const buscaLimpa = filtros.busca?.trim();

  const where: Prisma.PedidoDeCompraWhereInput = {
    ...(filtros.status ? { status: filtros.status } : {}),
    ...(filtros.fornecedorId ? { fornecedorId: filtros.fornecedorId } : {}),
    ...(filtros.dataInicio || filtros.dataFim
      ? { dataPedido: { gte: filtros.dataInicio, lte: filtros.dataFim } }
      : {}),
    ...(buscaLimpa
      ? {
          OR: [
            { id: { contains: buscaLimpa } },
            { fornecedor: { nome: { contains: buscaLimpa, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [pedidos, total] = await Promise.all([
    prisma.pedidoDeCompra.findMany({
      where,
      include: { fornecedor: true, itens: true },
      orderBy: { dataPedido: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.pedidoDeCompra.count({ where }),
  ]);

  return { pedidos, total, pagina, porPagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export async function contarPedidosEmAberto() {
  return prisma.pedidoDeCompra.count({ where: { status: { in: ["RASCUNHO", "ENVIADO"] } } });
}

export async function resumoComprasMes() {
  const inicio = new Date();
  inicio.setDate(1);
  inicio.setHours(0, 0, 0, 0);

  const recebidos = await prisma.pedidoDeCompra.findMany({
    where: { status: "RECEBIDO", dataRecebimento: { gte: inicio } },
    include: { itens: true },
  });

  const valorTotal = recebidos.reduce(
    (soma, pedido) =>
      soma +
      pedido.itens.reduce((s, item) => s + item.custoUnitario * (item.quantidade + item.quantidadeDemonstracao), 0) +
      pedido.valorFrete,
    0
  );

  return { quantidadeRecebidos: recebidos.length, valorTotal };
}
