"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { criarPecaRapida, ErroProduto } from "@/lib/produtos";
import type { ProdutoBusca } from "@/components/ProdutoAutocomplete";

export type ResultadoPecaRapida =
  | { ok: true; produto: ProdutoBusca }
  | { ok: false; erro: string };

/**
 * Cadastra uma peça direto do lançamento de pedido e devolve pronta para ser
 * adicionada à entrada, sem sair da tela.
 *
 * Existe porque a compra avulsa de uma peça só, de fornecedor qualquer, é
 * rotina nesta loja — e o cadastro completo no meio do caminho é o que faz
 * o lançamento não acontecer.
 */
export async function criarPecaRapidaAction(dados: {
  nome: string;
  precoVenda: number;
  precoCustoRef: number;
  /** Código bipado no lançamento, quando a peça ainda não existia. */
  codigoBarras?: string | null;
}): Promise<ResultadoPecaRapida> {
  let usuario;
  try {
    usuario = await requireEscrita("produtos");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    throw erro;
  }

  try {
    const produto = await criarPecaRapida(dados);

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "produto.criar_rapido",
      entidade: "Produto",
      entidadeId: produto.id,
      detalhes: `${produto.nome} (${produto.sku}) — cadastro rápido no lançamento de pedido`,
    });

    revalidatePath("/produtos");

    return {
      ok: true,
      produto: {
        id: produto.id,
        nome: produto.nome,
        marca: produto.marca,
        sku: produto.sku,
        precoVenda: produto.precoVenda,
        tipoVenda: produto.tipoVenda,
      },
    };
  } catch (erro) {
    if (erro instanceof ErroProduto) return { ok: false, erro: erro.message };
    throw erro;
  }
}
