import { prisma } from "@/lib/db";
import type { SessaoUsuario } from "@/lib/types";
import type { DadosProduto } from "@/lib/produtos";
import { criarCliente } from "@/lib/clientes";
import { registrarVenda, ErroVenda, cancelarVenda, registrarDevolucao, type DadosItemDevolucao } from "@/lib/vendas";
import { registrarEntradaEstoque, ErroEntradaEstoque } from "@/lib/entradaEstoque";
import { criarDespesa, criarDespesaRecorrente, marcarComoPaga, ErroDespesa } from "@/lib/despesas";
import { ajustarEstoquePorProduto, ErroEstoque, type TipoAjuste } from "@/lib/estoque";
import { atualizarProduto, criarProduto } from "@/lib/produtos";
import { criarFornecedor, atualizarFornecedor } from "@/lib/fornecedores";
import { criarPedido, ErroCompra } from "@/lib/compras";
import { registrarAuditoria } from "@/lib/auditoria";
import { centavosParaReais } from "@/lib/money";
import type { ToolResultado } from "./types";

const MARCADOR_ORIGEM = "Origem: Assistente de IA";

export type Executor = (args: Record<string, unknown>, usuario: SessaoUsuario, conversaId: string) => Promise<ToolResultado>;

// Composto cliente+venda: se o cliente já foi criado numa tentativa anterior
// (execução que falhou depois, ex: estoque mudou), não cria de novo — o id
// fica gravado no previewArgs da própria conversa entre tentativas.
async function resolverClienteParaVenda(
  args: Record<string, unknown>,
  usuario: SessaoUsuario,
  conversaId: string
): Promise<string | null> {
  if (args.clienteId) return String(args.clienteId);
  const novoCliente = args.novoCliente as { nome: string; telefone: string | null; email: string | null } | null;
  if (!novoCliente) return null;

  const conversa = await prisma.assistenteConversa.findUnique({ where: { id: conversaId } });
  const previewArgs = conversa?.previewArgs as Record<string, unknown> | null;
  const clienteJaCriado = previewArgs?.clienteIdCriado;
  if (typeof clienteJaCriado === "string") return clienteJaCriado;

  const cliente = await criarCliente({ nome: novoCliente.nome, telefone: novoCliente.telefone, email: novoCliente.email });
  await registrarAuditoria({ usuarioId: usuario.id, acao: "cliente.criar", entidade: "Cliente", entidadeId: cliente.id, detalhes: `${MARCADOR_ORIGEM} | ${cliente.nome}` });

  // Grava o id criado no previewArgs ANTES de tentar a venda — se a venda falhar
  // (ex: estoque mudou), uma nova confirmação não duplica o cliente.
  await prisma.assistenteConversa.update({
    where: { id: conversaId },
    data: { previewArgs: { ...previewArgs, clienteIdCriado: cliente.id } },
  });

  return cliente.id;
}

export const executores: Record<string, Executor> = {
  create_customer_preview: async (args, usuario) => {
    const nome = String(args.nome ?? "");
    const telefone = (args.telefone as string | null) ?? null;
    const email = (args.email as string | null) ?? null;

    const cliente = await criarCliente({ nome, telefone, email });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "cliente.criar",
      entidade: "Cliente",
      entidadeId: cliente.id,
      detalhes: `${MARCADOR_ORIGEM} | ${cliente.nome}`,
    });

    return {
      success: true,
      data: { id: cliente.id, nome: cliente.nome },
      message: `Cliente "${cliente.nome}" cadastrado com sucesso.`,
    };
  },

  create_sale_preview: async (args, usuario, conversaId) => {
    try {
      const clienteId = await resolverClienteParaVenda(args, usuario, conversaId);

      const itens = (
        args.itens as Array<{ produtoId: string; quantidade: number; descontoItem: number; precoUnitario?: number }>
      ).map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        descontoItem: item.descontoItem,
        precoUnitario: item.precoUnitario,
      }));

      const venda = await registrarVenda({
        itens,
        formaPagamento: args.formaPagamento as never,
        descontoTotal: args.descontoTotal as number,
        acrescimoTotal: args.acrescimoTotal as number,
        clienteId,
        usuarioId: usuario.id,
        dataHora: args.dataVenda ? new Date(args.dataVenda as string) : undefined,
        valorPago: args.valorPago as number,
        observacoes: (args.observacoes as string | null) ?? null,
      });

      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "venda.criar",
        entidade: "Venda",
        entidadeId: venda.id,
        detalhes: `${MARCADOR_ORIGEM} | ${itens.length} item(ns)`,
        valorNovo: venda.total,
      });

      return {
        success: true,
        data: { vendaId: venda.id, total: centavosParaReais(venda.total) },
        message: `Venda nº ${venda.id.slice(-6)} registrada com sucesso. Total: ${centavosParaReais(venda.total)}.`,
      };
    } catch (erro) {
      if (erro instanceof ErroVenda) {
        return { success: false, error_code: "PREVIEW_INVALIDA", message: erro.message };
      }
      throw erro;
    }
  },

  create_stock_entry_preview: async (args, usuario) => {
    try {
      const entrada = await registrarEntradaEstoque({
        itens: args.itens as Array<{ produtoId: string; quantidade: number; custoUnitario: number }>,
        valorFrete: args.valorFrete as number,
        fornecedorId: args.fornecedorId as string | null,
        dataEntrada: args.dataEntrada ? new Date(args.dataEntrada as string) : undefined,
        observacoes: args.observacoes as string | null,
        usuarioId: usuario.id,
      });

      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "estoque.entrada_criar",
        entidade: "EntradaEstoque",
        entidadeId: entrada.id,
        detalhes: `${MARCADOR_ORIGEM} | ${(args.itens as unknown[]).length} produto(s)`,
      });

      return {
        success: true,
        data: { entradaId: entrada.id },
        message: "Entrada de estoque registrada com sucesso.",
      };
    } catch (erro) {
      if (erro instanceof ErroEntradaEstoque) {
        return { success: false, error_code: "PREVIEW_INVALIDA", message: erro.message };
      }
      throw erro;
    }
  },

  create_expense_preview: async (args, usuario) => {
    try {
      const dados = {
        descricao: args.descricao as string,
        categoriaId: args.categoriaId as string,
        valor: args.valor as number,
        dataDespesa: new Date(args.dataDespesa as string),
        vencimento: args.vencimento ? new Date(args.vencimento as string) : null,
        classificacao: args.classificacao as never,
        formaPagamento: (args.formaPagamento as never) ?? null,
      };

      const recorrencia = args.recorrencia as string;
      const despesa =
        recorrencia && recorrencia !== "NENHUMA"
          ? await criarDespesaRecorrente(dados, recorrencia as never, usuario.id)
          : await criarDespesa(dados, usuario.id);

      if (args.jaPaga) {
        await marcarComoPaga(despesa.id, new Date(), dados.formaPagamento ?? undefined);
      }

      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "despesa.criar",
        entidade: "Despesa",
        entidadeId: despesa.id,
        detalhes: `${MARCADOR_ORIGEM} | ${despesa.descricao}`,
        valorNovo: despesa.valor,
      });

      return {
        success: true,
        data: { despesaId: despesa.id },
        message: `Despesa "${despesa.descricao}" lançada com sucesso.`,
      };
    } catch (erro) {
      if (erro instanceof ErroDespesa) {
        return { success: false, error_code: "PREVIEW_INVALIDA", message: erro.message };
      }
      throw erro;
    }
  },

  cancel_sale_preview: async (args, usuario) => {
    try {
      const venda = await cancelarVenda({
        vendaId: args.vendaId as string,
        usuarioId: usuario.id,
        motivo: args.motivo as string,
      });
      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "venda.cancelar",
        entidade: "Venda",
        entidadeId: venda.id,
        detalhes: `${MARCADOR_ORIGEM} | ${args.motivo}`,
      });
      return {
        success: true,
        data: { vendaId: venda.id },
        message: `Venda nº ${venda.id.slice(-6)} cancelada com sucesso. Os itens voltaram ao estoque.`,
      };
    } catch (erro) {
      if (erro instanceof ErroVenda) {
        return { success: false, error_code: "PREVIEW_INVALIDA", message: erro.message };
      }
      throw erro;
    }
  },

  create_return_preview: async (args, usuario) => {
    try {
      const devolucao = await registrarDevolucao({
        vendaId: args.vendaId as string,
        usuarioId: usuario.id,
        motivo: args.motivo as string,
        itens: args.itens as DadosItemDevolucao[],
      });
      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "venda.devolucao",
        entidade: "Venda",
        entidadeId: args.vendaId as string,
        detalhes: `${MARCADOR_ORIGEM} | ${args.motivo}`,
      });
      return {
        success: true,
        data: { devolucaoId: devolucao.id },
        message: "Devolução registrada com sucesso.",
      };
    } catch (erro) {
      if (erro instanceof ErroVenda) {
        return { success: false, error_code: "PREVIEW_INVALIDA", message: erro.message };
      }
      throw erro;
    }
  },

  create_stock_adjustment_preview: async (args, usuario) => {
    try {
      await ajustarEstoquePorProduto({
        produtoId: args.produtoId as string,
        pool: args.pool as "VENDA" | "DEMONSTRACAO",
        tipo: args.tipo as TipoAjuste,
        quantidade: args.quantidade as number,
        motivo: args.motivo as string,
        usuarioId: usuario.id,
      });
      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "estoque.ajuste",
        entidade: "Produto",
        entidadeId: args.produtoId as string,
        detalhes: `${MARCADOR_ORIGEM} | ${args.tipo} | ${args.motivo}`,
      });
      return {
        success: true,
        data: {},
        message: "Ajuste de estoque registrado com sucesso.",
      };
    } catch (erro) {
      if (erro instanceof ErroEstoque) {
        return { success: false, error_code: "PREVIEW_INVALIDA", message: erro.message };
      }
      throw erro;
    }
  },

  update_product_price_preview: async (args, usuario) => {
    const produtoAtual = await prisma.produto.findUnique({ where: { id: args.produtoId as string } });
    if (!produtoAtual) {
      return { success: false, error_code: "PRODUTO_NAO_ENCONTRADO", message: "Produto não encontrado." };
    }

    const dados: DadosProduto = {
      nome: produtoAtual.nome,
      marca: produtoAtual.marca,
      categoria: produtoAtual.categoria,
      medida: produtoAtual.medida,
      sku: produtoAtual.sku,
      codigoBarras: produtoAtual.codigoBarras,
      precoCustoRef: produtoAtual.precoCustoRef,
      precoVenda: args.precoVenda as number,
      fornecedorId: produtoAtual.fornecedorId,
      atributoA: produtoAtual.atributoA,
      atributoB: produtoAtual.atributoB,
      tipoVenda: produtoAtual.tipoVenda,
      estoqueMinimo: produtoAtual.estoqueMinimo,
    };
    const atualizado = await atualizarProduto(produtoAtual.id, dados);

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "produto.atualizar_preco",
      entidade: "Produto",
      entidadeId: atualizado.id,
      detalhes: MARCADOR_ORIGEM,
      valorAnterior: produtoAtual.precoVenda,
      valorNovo: atualizado.precoVenda,
    });

    return {
      success: true,
      data: { produtoId: atualizado.id },
      message: `Preço de "${atualizado.nome}" atualizado para ${centavosParaReais(atualizado.precoVenda)}.`,
    };
  },

  create_product_preview: async (args, usuario) => {
    const produtos = args.produtos as Array<DadosProduto>;
    const criados: string[] = [];

    for (const dados of produtos) {
      const produto = await criarProduto(dados);
      criados.push(`${produto.nome} (${produto.marca}) — SKU ${produto.sku}`);
      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "produto.criar",
        entidade: "Produto",
        entidadeId: produto.id,
        detalhes: `${MARCADOR_ORIGEM} | ${produto.nome} / ${produto.marca}`,
        valorNovo: produto.precoVenda,
      });
    }

    return {
      success: true,
      data: { quantidade: criados.length },
      message:
        criados.length === 1
          ? `Produto cadastrado: ${criados[0]}. Estoque zerado — lance a entrada para dar entrada nas unidades.`
          : `${criados.length} produtos cadastrados: ${criados.join("; ")}. Todos com estoque zerado — lance a entrada de estoque para dar entrada nas unidades.`,
    };
  },

  create_supplier_preview: async (args, usuario) => {
    const nome = String(args.nome ?? "");
    const fornecedor = await criarFornecedor({
      nome,
      documento: (args.documento as string | null) ?? null,
      telefone: (args.telefone as string | null) ?? null,
      email: (args.email as string | null) ?? null,
      endereco: (args.endereco as string | null) ?? null,
      observacoes: (args.observacoes as string | null) ?? null,
    });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "fornecedor.criar",
      entidade: "Fornecedor",
      entidadeId: fornecedor.id,
      detalhes: `${MARCADOR_ORIGEM} | ${fornecedor.nome}`,
    });

    return {
      success: true,
      data: { id: fornecedor.id, nome: fornecedor.nome },
      message: `Fornecedor "${fornecedor.nome}" cadastrado com sucesso.`,
    };
  },

  update_supplier_preview: async (args, usuario) => {
    const fornecedorId = String(args.fornecedorId ?? "");
    const fornecedor = await atualizarFornecedor(fornecedorId, {
      nome: String(args.nome ?? ""),
      documento: (args.documento as string | null) ?? null,
      telefone: (args.telefone as string | null) ?? null,
      email: (args.email as string | null) ?? null,
      endereco: (args.endereco as string | null) ?? null,
      observacoes: (args.observacoes as string | null) ?? null,
    });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "fornecedor.atualizar",
      entidade: "Fornecedor",
      entidadeId: fornecedor.id,
      detalhes: MARCADOR_ORIGEM,
    });

    return {
      success: true,
      data: { id: fornecedor.id },
      message: `Fornecedor "${fornecedor.nome}" atualizado com sucesso.`,
    };
  },

  create_purchase_order_preview: async (args, usuario) => {
    try {
      const pedido = await criarPedido({
        fornecedorId: args.fornecedorId as string,
        itens: args.itens as Array<{ produtoId: string; quantidade: number; quantidadeDemonstracao?: number; custoUnitario: number }>,
        valorFrete: args.valorFrete as number,
        observacoes: args.observacoes as string | null,
      });

      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "compra.pedido_criar",
        entidade: "PedidoDeCompra",
        entidadeId: pedido.id,
        detalhes: `${MARCADOR_ORIGEM} | ${pedido.itens.length} item(ns)`,
      });

      return {
        success: true,
        data: { pedidoId: pedido.id },
        message: `Pedido de compra nº ${pedido.id.slice(-6)} registrado como rascunho. Acesse Compras para enviar e depois receber (com número de lote).`,
      };
    } catch (erro) {
      if (erro instanceof ErroCompra) {
        return { success: false, error_code: "PREVIEW_INVALIDA", message: erro.message };
      }
      throw erro;
    }
  },
};
