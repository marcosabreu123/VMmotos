"use server";

import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { lerFotoDoPedido, ErroLeituraPedido } from "@/lib/assistente/lerPedido";
import { ErroAssistente } from "@/lib/assistente/config";
import { buscarProdutosParaVenda } from "@/lib/produtos";
import { listarFornecedores } from "@/lib/fornecedores";

/**
 * Lê a foto do pedido e devolve os itens JÁ CASADOS com o catálogo.
 *
 * Nada é gravado aqui. O resultado preenche o formulário de entrada, que o
 * dono confere e salva — errar o custo de entrada contamina o lucro de todas
 * as vendas daquele lote, então a última palavra é sempre dele.
 */

export type ItemCasado = {
  /** O que estava escrito na nota. */
  descricaoLida: string;
  quantidade: number;
  custoUnitario: number;
  /** Peça do catálogo que bate, quando houver. */
  produto: { id: string; nome: string; sku: string; tipoVenda: "UNIDADE" | "FRACIONADO" } | null;
};

export type ResultadoLeitura =
  | {
      ok: true;
      fornecedor: { id: string; nome: string } | null;
      fornecedorLido: string | null;
      frete: number;
      itens: ItemCasado[];
      observacao: string | null;
    }
  | { ok: false; erro: string };

export async function lerFotoPedidoAction(formData: FormData): Promise<ResultadoLeitura> {
  let usuario;
  try {
    usuario = await requireEscrita("estoque");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    throw erro;
  }

  const arquivo = formData.get("foto");
  if (!(arquivo instanceof File)) {
    return { ok: false, erro: "Nenhuma foto recebida." };
  }

  let pedido;
  try {
    pedido = await lerFotoDoPedido(arquivo);
  } catch (erro) {
    if (erro instanceof ErroLeituraPedido) return { ok: false, erro: erro.message };
    if (erro instanceof ErroAssistente) return { ok: false, erro: erro.message };
    throw erro;
  }

  if (pedido.itens.length === 0) {
    return {
      ok: false,
      erro: pedido.observacao
        ? `Não encontrei itens nesta foto. ${pedido.observacao}`
        : "Não encontrei itens nesta foto. Tente outra, mais próxima e sem sombra.",
    };
  }

  // Casa cada descrição lida com o catálogo usando a MESMA busca tolerante a
  // erro de digitação do resto do sistema — nota de fornecedor abrevia
  // ("past freio diant"), e busca exata não acharia nada.
  const itens: ItemCasado[] = [];
  for (const item of pedido.itens) {
    const achados = await buscarProdutosParaVenda({ termo: item.descricao });
    const melhor = achados[0];
    itens.push({
      descricaoLida: item.descricao,
      quantidade: item.quantidade,
      custoUnitario: item.custoUnitario,
      produto: melhor
        ? { id: melhor.id, nome: melhor.nome, sku: melhor.sku, tipoVenda: melhor.tipoVenda }
        : null,
    });
  }

  // O fornecedor lido também passa pela busca; não achar não é erro.
  let fornecedor: { id: string; nome: string } | null = null;
  if (pedido.fornecedor) {
    const achados = await listarFornecedores(pedido.fornecedor);
    if (achados[0]) fornecedor = { id: achados[0].id, nome: achados[0].nome };
  }

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "estoque.foto_lida",
    entidade: "EntradaEstoque",
    detalhes: `${itens.length} item(ns) lidos da foto; ${itens.filter((i) => i.produto).length} casaram com o catálogo`,
  });

  return {
    ok: true,
    fornecedor,
    fornecedorLido: pedido.fornecedor,
    frete: pedido.frete,
    itens,
    observacao: pedido.observacao,
  };
}
