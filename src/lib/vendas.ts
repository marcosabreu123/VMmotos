import { prisma } from "./db";
import type { FormaPagamento, StatusVenda, Prisma } from "@prisma/client";

export type ItemCarrinho = {
  produtoId: string;
  quantidade: number;
  descontoItem?: number; // centavos
  // Preço combinado com o cliente, quando diferente do cadastro. O campo
  // precoUnitario do ItemVenda é justamente o snapshot do preço praticado na
  // venda — se a peça saiu por outro valor, é esse que vale. Omitido = usa o
  // preço do cadastro. Cobre tanto vender mais barato quanto mais caro, o que
  // o descontoItem sozinho não conseguia representar.
  precoUnitario?: number; // centavos
};

export type DadosVenda = {
  itens: ItemCarrinho[];
  formaPagamento: FormaPagamento;
  descontoTotal?: number; // centavos
  acrescimoTotal?: number; // centavos — taxa de cartão, frete cobrado à parte etc.
  clienteId?: string | null;
  usuarioId: string;
  dataHora?: Date; // permite lançar uma venda com data retroativa; padrão é agora
  valorPago?: number; // centavos — se menor que o total, o restante fica como débito do cliente; padrão é o total (pago integralmente)
  observacoes?: string | null; // anotação livre: combinado de pagamento, entrega etc.
};

export class ErroVenda extends Error {}

// FEFO: prioriza o lote ATIVO com validade mais próxima; produtos sem nenhum lote
// com validade caem no FIFO por data de criação. O split automático de uma venda
// entre múltiplos lotes fica fora de escopo — se um lote não tiver saldo suficiente,
// pede-se para o vendedor lançar a diferença como uma segunda linha no carrinho.
async function encontrarLoteFEFO(tx: Prisma.TransactionClient, produtoId: string, quantidadeMinima: number) {
  const comValidade = await tx.lote.findFirst({
    where: {
      produtoId,
      status: "ATIVO",
      quantidadeAtualVenda: { gte: quantidadeMinima },
      dataValidade: { not: null },
    },
    orderBy: { dataValidade: "asc" },
  });
  if (comValidade) return comValidade;

  return tx.lote.findFirst({
    where: {
      produtoId,
      status: "ATIVO",
      quantidadeAtualVenda: { gte: quantidadeMinima },
      dataValidade: null,
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function registrarVenda(dados: DadosVenda) {
  if (dados.itens.length === 0) {
    throw new ErroVenda("O carrinho está vazio.");
  }

  // Os produtos são lidos ANTES da transação: são dados estáveis (nome, preço,
  // ativo) e buscá-los um a um lá dentro custava uma ida ao banco por item.
  // Numa venda de 7 itens isso somava dezenas de idas em sequência e estourava
  // o limite de tempo da transação, derrubando a venda inteira.
  const produtos = await prisma.produto.findMany({
    where: { id: { in: [...new Set(dados.itens.map((item) => item.produtoId))] } },
  });
  const produtoPorId = new Map(produtos.map((produto) => [produto.id, produto]));

  return prisma.$transaction(
    async (tx) => {
    let subtotal = 0;
    const itensParaCriar: Array<{
      produtoId: string;
      loteId: string;
      quantidade: number;
      precoUnitario: number;
      descontoItem: number;
      custoRealSnapshot: number;
      subtotalItem: number;
    }> = [];

    for (const item of dados.itens) {
      if (item.quantidade <= 0) {
        throw new ErroVenda("Quantidade inválida no carrinho.");
      }

      const produto = produtoPorId.get(item.produtoId);
      if (!produto || !produto.ativo) {
        throw new ErroVenda("Produto não encontrado ou inativo.");
      }

      const lote = await encontrarLoteFEFO(tx, item.produtoId, item.quantidade);

      if (!lote) {
        throw new ErroVenda(
          `Estoque insuficiente em um único lote para "${produto.nome}" (quantidade pedida: ${item.quantidade}). Divida em mais de uma linha no carrinho ou dê entrada de estoque.`
        );
      }

      await tx.lote.update({
        where: { id: lote.id },
        data: { quantidadeAtualVenda: { decrement: item.quantidade } },
      });

      const descontoItem = item.descontoItem ?? 0;
      const precoUnitario = item.precoUnitario ?? produto.precoVenda;
      if (precoUnitario < 0) {
        throw new ErroVenda(`Preço unitário inválido para "${produto.nome}".`);
      }
      const subtotalItem = precoUnitario * item.quantidade - descontoItem;
      if (subtotalItem < 0) {
        throw new ErroVenda(`O desconto informado para "${produto.nome}" é maior que o valor do item.`);
      }
      subtotal += subtotalItem;

      itensParaCriar.push({
        produtoId: item.produtoId,
        loteId: lote.id,
        quantidade: item.quantidade,
        precoUnitario,
        descontoItem,
        custoRealSnapshot: lote.custoReal,
        subtotalItem,
      });
    }

    const descontoTotal = dados.descontoTotal ?? 0;
    const acrescimoTotal = dados.acrescimoTotal ?? 0;
    const total = subtotal - descontoTotal + acrescimoTotal;
    const valorPago = dados.valorPago ?? total;

    if (valorPago < 0 || valorPago > total) {
      throw new ErroVenda("Valor pago inválido — não pode ser negativo nem maior que o total da venda.");
    }

    const venda = await tx.venda.create({
      data: {
        usuarioId: dados.usuarioId,
        clienteId: dados.clienteId ?? null,
        formaPagamento: dados.formaPagamento,
        descontoTotal,
        acrescimoTotal,
        subtotal,
        total,
        valorPago,
        observacoes: dados.observacoes?.trim() || null,
        dataHora: dados.dataHora ?? undefined,
        itens: { create: itensParaCriar },
      },
      include: { itens: true },
    });

    // createMany em vez de um create por item: uma ida ao banco no lugar de N.
    await tx.movimentacaoEstoque.createMany({
      data: venda.itens.map((item) => ({
        produtoId: item.produtoId,
        loteId: item.loteId,
        tipo: "SAIDA_VENDA" as const,
        pool: "VENDA" as const,
        quantidade: item.quantidade,
        usuarioId: dados.usuarioId,
        vendaId: venda.id,
      })),
    });

    return venda;
    },
    // O padrão do Prisma é 5s, apertado demais para uma venda de muitos itens
    // num banco remoto: cada item ainda faz a seleção de lote (FEFO) e a baixa
    // dentro da transação. Estourar o prazo aqui aborta a venda inteira com
    // "Transaction not found", que foi exatamente o erro que apareceu.
    { maxWait: 15_000, timeout: 30_000 }
  );
}

// ---------- Pagamentos (débito de clientes) ----------

// Incrementa o valor pago de uma venda — usado pra ir regularizando uma venda
// que ficou com saldo em aberto (cliente fiado). Não mexe em estoque nem em
// status da venda, só no controle financeiro.
export async function registrarPagamentoVenda(params: { vendaId: string; valor: number }) {
  if (params.valor <= 0) {
    throw new ErroVenda("Informe um valor de pagamento válido.");
  }

  const venda = await prisma.venda.findUnique({ where: { id: params.vendaId } });
  if (!venda) {
    throw new ErroVenda("Venda não encontrada.");
  }

  const saldoDevedor = venda.total - venda.valorPago;
  if (saldoDevedor <= 0) {
    throw new ErroVenda("Esta venda já está totalmente paga.");
  }
  if (params.valor > saldoDevedor) {
    throw new ErroVenda(`O valor informado é maior que o saldo devedor (${saldoDevedor} centavos).`);
  }

  return prisma.venda.update({
    where: { id: params.vendaId },
    data: { valorPago: { increment: params.valor } },
  });
}

// Agrupa por cliente o saldo em aberto (total - valorPago) de todas as vendas não
// canceladas — a "área de débitos" pra acompanhar quem ainda deve e regularizar.
export async function listarClientesEmDebito() {
  const vendas = await prisma.venda.findMany({
    where: { status: { not: "CANCELADA" }, clienteId: { not: null } },
    include: { cliente: true },
    orderBy: { dataHora: "asc" },
  });

  const porCliente = new Map<
    string,
    { cliente: NonNullable<(typeof vendas)[number]["cliente"]>; saldoDevedor: number; quantidadeVendas: number }
  >();

  for (const venda of vendas) {
    const saldo = venda.total - venda.valorPago;
    if (saldo <= 0 || !venda.cliente || !venda.clienteId) continue;

    const atual = porCliente.get(venda.clienteId) ?? { cliente: venda.cliente, saldoDevedor: 0, quantidadeVendas: 0 };
    atual.saldoDevedor += saldo;
    atual.quantidadeVendas += 1;
    porCliente.set(venda.clienteId, atual);
  }

  return Array.from(porCliente.values()).sort((a, b) => b.saldoDevedor - a.saldoDevedor);
}

// ---------- Cancelamento e devolução ----------

export async function cancelarVenda(params: { vendaId: string; usuarioId: string; motivo: string }) {
  const motivo = params.motivo.trim();
  if (!motivo) {
    throw new ErroVenda("Informe o motivo do cancelamento.");
  }

  return prisma.$transaction(async (tx) => {
    const venda = await tx.venda.findUnique({ where: { id: params.vendaId }, include: { itens: true } });
    if (!venda) {
      throw new ErroVenda("Venda não encontrada.");
    }
    if (venda.status === "CANCELADA") {
      throw new ErroVenda("Esta venda já foi cancelada.");
    }

    for (const item of venda.itens) {
      await tx.lote.update({
        where: { id: item.loteId },
        data: { quantidadeAtualVenda: { increment: item.quantidade } },
      });

      await tx.movimentacaoEstoque.create({
        data: {
          produtoId: item.produtoId,
          loteId: item.loteId,
          tipo: "ESTORNO_CANCELAMENTO",
          pool: "VENDA",
          quantidade: item.quantidade,
          usuarioId: params.usuarioId,
          vendaId: venda.id,
          observacao: `Cancelamento: ${motivo}`,
        },
      });
    }

    return tx.venda.update({
      where: { id: venda.id },
      data: {
        status: "CANCELADA",
        motivoCancelamento: motivo,
        canceladoPorId: params.usuarioId,
        canceladoEm: new Date(),
      },
    });
  }, { maxWait: 15_000, timeout: 30_000 });
}

export type DadosItemDevolucao = { itemVendaId: string; quantidade: number; retornaEstoque: boolean };

export async function registrarDevolucao(params: {
  vendaId: string;
  usuarioId: string;
  motivo: string;
  itens: DadosItemDevolucao[];
}) {
  const motivo = params.motivo.trim();
  if (!motivo) {
    throw new ErroVenda("Informe o motivo da devolução.");
  }
  if (params.itens.length === 0) {
    throw new ErroVenda("Selecione ao menos um item para devolver.");
  }

  return prisma.$transaction(async (tx) => {
    const venda = await tx.venda.findUnique({
      where: { id: params.vendaId },
      include: { itens: { include: { itensDevolvidos: true } } },
    });
    if (!venda) {
      throw new ErroVenda("Venda não encontrada.");
    }
    if (venda.status === "CANCELADA") {
      throw new ErroVenda("Uma venda cancelada não pode receber devolução.");
    }

    const devolucao = await tx.devolucao.create({
      data: { vendaId: venda.id, usuarioId: params.usuarioId, motivo },
    });

    for (const itemPedido of params.itens) {
      const itemVenda = venda.itens.find((item) => item.id === itemPedido.itemVendaId);
      if (!itemVenda) {
        throw new ErroVenda("Item da venda não encontrado.");
      }

      const jaDevolvido = itemVenda.itensDevolvidos.reduce((soma, item) => soma + item.quantidade, 0);
      const disponivelParaDevolver = itemVenda.quantidade - jaDevolvido;

      if (itemPedido.quantidade <= 0 || itemPedido.quantidade > disponivelParaDevolver) {
        throw new ErroVenda(
          `Quantidade de devolução inválida (disponível para devolver: ${disponivelParaDevolver}).`
        );
      }

      await tx.itemDevolucao.create({
        data: {
          devolucaoId: devolucao.id,
          itemVendaId: itemVenda.id,
          quantidade: itemPedido.quantidade,
          retornaEstoque: itemPedido.retornaEstoque,
        },
      });

      if (itemPedido.retornaEstoque) {
        await tx.lote.update({
          where: { id: itemVenda.loteId },
          data: { quantidadeAtualVenda: { increment: itemPedido.quantidade } },
        });
      }

      await tx.movimentacaoEstoque.create({
        data: {
          produtoId: itemVenda.produtoId,
          loteId: itemVenda.loteId,
          tipo: "DEVOLUCAO",
          pool: "VENDA",
          quantidade: itemPedido.quantidade,
          usuarioId: params.usuarioId,
          vendaId: venda.id,
          observacao: motivo,
        },
      });
    }

    const totalItensVenda = venda.itens.reduce((soma, item) => soma + item.quantidade, 0);
    const totalDevolvidoAntes = venda.itens.reduce(
      (soma, item) => soma + item.itensDevolvidos.reduce((s, devolvido) => s + devolvido.quantidade, 0),
      0
    );
    const totalDevolvidoAgora = params.itens.reduce((soma, item) => soma + item.quantidade, 0);
    const totalDevolvidoFinal = totalDevolvidoAntes + totalDevolvidoAgora;

    const novoStatus = totalDevolvidoFinal >= totalItensVenda ? "DEVOLVIDA_TOTAL" : "DEVOLVIDA_PARCIAL";
    await tx.venda.update({ where: { id: venda.id }, data: { status: novoStatus } });

    return devolucao;
  }, { maxWait: 15_000, timeout: 30_000 });
}

export async function adicionarObservacaoVenda(vendaId: string, observacoes: string) {
  return prisma.venda.update({ where: { id: vendaId }, data: { observacoes } });
}

export async function corrigirClienteVenda(vendaId: string, clienteId: string | null) {
  return prisma.venda.update({ where: { id: vendaId }, data: { clienteId } });
}

// ---------- Consulta e histórico ----------

export async function buscarVendaPorId(id: string) {
  return prisma.venda.findUnique({
    where: { id },
    include: {
      cliente: true,
      usuario: true,
      canceladoPor: true,
      itens: { include: { produto: true, lote: true, itensDevolvidos: true } },
      movimentacoes: { include: { produto: true, usuario: true }, orderBy: { createdAt: "asc" } },
      devolucoes: {
        include: { usuario: true, itens: { include: { itemVenda: { include: { produto: true } } } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export type FiltrosVendas = {
  dataInicio?: Date;
  dataFim?: Date;
  clienteId?: string;
  produtoId?: string;
  usuarioId?: string;
  formaPagamento?: FormaPagamento;
  status?: StatusVenda;
  valorMinimo?: number; // centavos
  valorMaximo?: number; // centavos
  comDesconto?: boolean;
  busca?: string;
  pagina?: number;
  porPagina?: number;
  ordenarPor?: "dataHora" | "total";
  ordem?: "asc" | "desc";
};

export async function listarVendas(filtros: FiltrosVendas = {}) {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const porPagina = filtros.porPagina ?? 20;
  const buscaLimpa = filtros.busca?.trim();

  const where: Prisma.VendaWhereInput = {
    ...(filtros.dataInicio || filtros.dataFim
      ? { dataHora: { gte: filtros.dataInicio, lte: filtros.dataFim } }
      : {}),
    ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
    ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
    ...(filtros.formaPagamento ? { formaPagamento: filtros.formaPagamento } : {}),
    ...(filtros.status ? { status: filtros.status } : {}),
    ...(filtros.produtoId ? { itens: { some: { produtoId: filtros.produtoId } } } : {}),
    ...(filtros.comDesconto ? { descontoTotal: { gt: 0 } } : {}),
    ...(filtros.valorMinimo !== undefined || filtros.valorMaximo !== undefined
      ? { total: { gte: filtros.valorMinimo, lte: filtros.valorMaximo } }
      : {}),
    ...(buscaLimpa
      ? {
          OR: [
            { id: { contains: buscaLimpa } },
            { cliente: { nome: { contains: buscaLimpa, mode: "insensitive" } } },
            { cliente: { telefone: { contains: buscaLimpa } } },
            { itens: { some: { produto: { nome: { contains: buscaLimpa, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };

  const [vendas, total] = await Promise.all([
    prisma.venda.findMany({
      where,
      include: { cliente: true, usuario: true, itens: true },
      orderBy: { [filtros.ordenarPor ?? "dataHora"]: filtros.ordem ?? "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.venda.count({ where }),
  ]);

  return {
    vendas,
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}
