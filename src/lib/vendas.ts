import { prisma } from "./db";
import type { FormaPagamento, StatusVenda, Prisma } from "@prisma/client";
import {
  dividirMaoDeObra,
  ErroRepasse,
  type BeneficiarioRepasse,
  type RepasseCalculado,
} from "./oficina/repasse";

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

/**
 * Uma linha de mão de obra da venda.
 *
 * O valor é digitado, não vem de tabela: o serviço é negociado caso a caso.
 * `beneficiarios` já chega resolvido da tela (o padrão é sócio + executor,
 * editável); lista vazia = ninguém recebe, que é o caso do retorno de
 * garantia.
 */
export type ServicoVenda = {
  /** Tipo escolhido do catálogo, quando houver. */
  tipoServicoId?: string | null;
  descricao: string;
  /** centavos */
  valor: number;
  beneficiarios: BeneficiarioRepasse[];
};

export type DadosVenda = {
  itens: ItemCarrinho[];
  /** Mão de obra lançada na mesma venda das peças. */
  servicos?: ServicoVenda[];
  /** Moto atendida — só faz sentido quando houve serviço, e é opcional. */
  motoId?: string | null;
  /** Retorno de garantia: aponta para a venda de origem do serviço. */
  vendaGarantiaDeId?: string | null;
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

/**
 * Separa a quantidade pedida percorrendo os lotes em FEFO (validade mais
 * próxima primeiro) e, entre os sem validade, FIFO por data de entrada.
 *
 * Percorre VÁRIOS lotes de propósito. A loja compra a mesma peça de novo toda
 * semana, então o estoque nasce picado: 3 de uma compra, 4 de outra. Antes a
 * venda exigia um lote único com o saldo inteiro e recusava vender 5 tendo 7 —
 * e a saída que a mensagem sugeria (lançar em duas linhas) não existia, porque
 * o carrinho soma a mesma peça na mesma linha. Ou seja: venda perdida com a
 * peça na prateleira.
 *
 * Cada pedaço vira um ItemVenda com o custo do SEU lote, o que também deixa o
 * lucro mais correto do que quando tudo era debitado de um lote só.
 */
async function separarLotesFEFO(
  tx: Prisma.TransactionClient,
  produtoId: string,
  quantidade: number
): Promise<Array<{ loteId: string; custoReal: number; quantidade: number }> | null> {
  const lotes = await tx.lote.findMany({
    where: { produtoId, status: "ATIVO", quantidadeAtualVenda: { gt: 0 } },
    orderBy: [{ dataValidade: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  const separado: Array<{ loteId: string; custoReal: number; quantidade: number }> = [];
  let falta = quantidade;

  for (const lote of lotes) {
    if (falta <= 0) break;
    const tirar = Math.min(falta, lote.quantidadeAtualVenda);
    separado.push({ loteId: lote.id, custoReal: lote.custoReal, quantidade: tirar });
    falta -= tirar;
  }

  return falta > 0 ? null : separado;
}

/** Divide um valor em partes proporcionais; a última absorve o arredondamento. */
function ratear(valor: number, pesos: number[]): number[] {
  const total = pesos.reduce((s, p) => s + p, 0);
  if (total <= 0) return pesos.map(() => 0);

  const partes = pesos.map((p) => Math.floor((valor * p) / total));
  const sobra = valor - partes.reduce((s, p) => s + p, 0);
  partes[partes.length - 1] += sobra;
  return partes;
}

export async function registrarVenda(dados: DadosVenda) {
  const servicos = dados.servicos ?? [];

  // Venda só de mão de obra é rotina numa oficina (o cliente traz a peça, ou
  // é só serviço). Por isso o carrinho vazio só é erro quando também não há
  // serviço nenhum.
  if (dados.itens.length === 0 && servicos.length === 0) {
    throw new ErroVenda("Adicione ao menos uma peça ou um serviço.");
  }

  for (const servico of servicos) {
    if (!servico.descricao.trim()) {
      throw new ErroVenda("Descreva o serviço realizado.");
    }
    if (!Number.isInteger(servico.valor) || servico.valor < 0) {
      throw new ErroVenda(`Valor inválido para o serviço "${servico.descricao}".`);
    }
  }

  // Os mecânicos são conferidos ANTES da transação, pelo mesmo motivo dos
  // produtos: são dados estáveis e buscá-los lá dentro só encomprida a
  // transação. Aqui a checagem também evita gravar repasse para mecânico
  // inexistente ou arquivado, que ninguém veria para pagar depois.
  const idsMecanicos = [
    ...new Set(servicos.flatMap((s) => s.beneficiarios.map((b) => b.mecanicoId))),
  ];
  if (idsMecanicos.length > 0) {
    const encontrados = await prisma.mecanico.findMany({
      where: { id: { in: idsMecanicos }, ativo: true },
      select: { id: true },
    });
    if (encontrados.length !== idsMecanicos.length) {
      throw new ErroVenda("Algum mecânico da divisão não existe mais ou foi arquivado.");
    }
  }

  // A divisão é calculada e conferida ANTES de abrir a transação, por dois
  // motivos: uma divisão inválida derruba a venda sem nada ter sido gravado,
  // e o erro chega como ErroVenda — que é o que as telas sabem transformar em
  // mensagem. Deixado lá dentro, o ErroRepasse subiria cru e viraria erro de
  // servidor na cara do usuário.
  let repassesPorServico: RepasseCalculado[][];
  try {
    repassesPorServico = servicos.map((s) => dividirMaoDeObra(s.valor, s.beneficiarios));
  } catch (erro) {
    if (erro instanceof ErroRepasse) throw new ErroVenda(erro.message);
    throw erro;
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

      const separado = await separarLotesFEFO(tx, item.produtoId, item.quantidade);

      if (!separado) {
        throw new ErroVenda(
          `Estoque insuficiente para "${produto.nome}" (quantidade pedida: ${item.quantidade}). Dê entrada de estoque antes de vender.`
        );
      }

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

      // Um desconto de item vale para a peça inteira, não para um lote; é
      // rateado pelas quantidades para que a soma das linhas continue exata.
      const descontosPorLote = ratear(descontoItem, separado.map((s) => s.quantidade));

      for (const [indice, pedaco] of separado.entries()) {
        // Decremento CONDICIONAL: a condição de saldo vai junto no UPDATE, e é
        // o banco que a reavalia com a linha travada. Um update simples deixava
        // duas vendas simultâneas da última peça passarem as duas — as duas
        // liam "tem 1" antes de qualquer uma gravar, e o estoque ia a -1.
        const atualizados = await tx.lote.updateMany({
          where: { id: pedaco.loteId, quantidadeAtualVenda: { gte: pedaco.quantidade } },
          data: { quantidadeAtualVenda: { decrement: pedaco.quantidade } },
        });
        if (atualizados.count !== 1) {
          throw new ErroVenda(
            `O estoque de "${produto.nome}" mudou enquanto esta venda era fechada. Confira a quantidade e lance de novo.`
          );
        }

        itensParaCriar.push({
          produtoId: item.produtoId,
          loteId: pedaco.loteId,
          quantidade: pedaco.quantidade,
          precoUnitario,
          descontoItem: descontosPorLote[indice],
          custoRealSnapshot: pedaco.custoReal,
          subtotalItem: precoUnitario * pedaco.quantidade - descontosPorLote[indice],
        });
      }
    }

    const subtotalPecas = subtotal;
    const totalServicos = servicos.reduce((soma, s) => soma + s.valor, 0);
    subtotal += totalServicos;

    const descontoTotal = dados.descontoTotal ?? 0;
    const acrescimoTotal = dados.acrescimoTotal ?? 0;

    // Regra do dono: desconto é só no preço das peças, nunca na mão de obra.
    // A mão de obra não é dinheiro dele para dar de desconto — é do pessoal da
    // oficina. Sem este limite, um desconto grande sairia do bolso do mecânico
    // sem ninguém perceber, porque o repasse é calculado sobre o valor cheio
    // do serviço.
    if (descontoTotal > subtotalPecas) {
      throw new ErroVenda(
        "O desconto não pode passar do valor das peças — mão de obra não entra em desconto."
      );
    }

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
        motoId: dados.motoId ?? null,
        vendaGarantiaDeId: dados.vendaGarantiaDeId ?? null,
        itens: { create: itensParaCriar },
      },
      include: { itens: true },
    });

    // ---- Mão de obra e repasse ----
    //
    // O repasse nasce PENDENTE e só vira A_PAGAR quando o cliente quita, que
    // é a regra do dono ("o mecânico recebe quando o cliente paga"). Quando a
    // venda já sai paga, o repasse nasce direto como A_PAGAR.
    const vendaQuitada = valorPago >= total;

    for (const [indice, servico] of servicos.entries()) {
      const linha = await tx.itemVendaServico.create({
        data: {
          vendaId: venda.id,
          tipoServicoId: servico.tipoServicoId ?? null,
          descricao: servico.descricao.trim(),
          valor: servico.valor,
        },
      });

      // Já calculado e conferido acima. Lista vazia (garantia) não gera nada.
      const repasses = repassesPorServico[indice];
      if (repasses.length > 0) {
        await tx.repasseMaoDeObra.createMany({
          data: repasses.map((r) => ({
            itemVendaServicoId: linha.id,
            mecanicoId: r.mecanicoId,
            percentual: r.percentual,
            valor: r.valor,
            status: vendaQuitada ? ("A_PAGAR" as const) : ("PENDENTE" as const),
          })),
        });
      }
    }

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

  return prisma.$transaction(async (tx) => {
    const atualizada = await tx.venda.update({
      where: { id: params.vendaId },
      data: { valorPago: { increment: params.valor } },
    });

    // O momento em que o cliente termina de pagar é o momento em que a mão de
    // obra passa a ser devida ao mecânico — regra do dono. Fica na mesma
    // transação do pagamento: registrar que o cliente pagou e esquecer de
    // liberar o repasse deixaria o mecânico sem receber sem ninguém notar.
    if (atualizada.valorPago >= atualizada.total) {
      await tx.repasseMaoDeObra.updateMany({
        where: {
          status: "PENDENTE",
          itemVendaServico: { vendaId: atualizada.id },
        },
        data: { status: "A_PAGAR" },
      });
    }

    return atualizada;
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

    // Venda cancelada não paga mão de obra. Sem isto o repasse continuaria
    // "a pagar" e entraria no fechamento da semana — o dono pagaria por um
    // serviço que ele mesmo desfez. Repasse JÁ PAGO não é tocado: aquele
    // dinheiro saiu do caixa e desfazer no sistema não o traz de volta.
    await tx.repasseMaoDeObra.updateMany({
      where: {
        status: { in: ["PENDENTE", "A_PAGAR"] },
        itemVendaServico: { vendaId: venda.id },
      },
      data: { status: "CANCELADO" },
    });

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
  /**
   * Esconde vendas canceladas (Vendedor não as vê — ver
   * podeVerVendasCanceladas). Vem como AND separado justamente para valer
   * mesmo quando `status` foi filtrado explicitamente: pedir
   * status=CANCELADA sem permissão devolve nada, e não a lista proibida.
   */
  ocultarCanceladas?: boolean;
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
    ...(filtros.ocultarCanceladas ? { AND: [{ status: { not: "CANCELADA" as const } }] } : {}),
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
