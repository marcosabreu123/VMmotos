"use server";

import { requireLeitura, requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { buscarPorCodigoExato, buscarParaVendaPorCodigo, type ProdutoParaVenda } from "@/lib/produtos";

/**
 * O que o leitor de código de barras consulta.
 *
 * São duas perguntas diferentes e por isso são duas ações:
 *
 * - na VENDA, "que peça é essa?" — e a resposta entra direto no carrinho;
 * - no CADASTRO, "esse código já é de alguém?" — e a resposta evita cadastrar
 *   a mesma peça duas vezes, que é o erro clássico de quem bipa no balcão.
 */

export type ResultadoBipe =
  | { status: "achou"; produto: ProdutoParaVenda }
  | { status: "arquivada"; nome: string }
  | { status: "desconhecido"; codigo: string }
  | { status: "erro"; mensagem: string };

export async function biparParaVendaAction(codigo: string): Promise<ResultadoBipe> {
  try {
    await requireLeitura("vendas");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { status: "erro", mensagem: erro.message };
    throw erro;
  }

  const limpo = codigo.trim();
  if (!limpo) return { status: "erro", mensagem: "Código vazio." };

  const produto = await buscarParaVendaPorCodigo(limpo);
  if (produto) return { status: "achou", produto };

  // Não achou entre as ativas: pode ser peça arquivada. Dizer "não existe"
  // nesse caso faria o dono cadastrar de novo a peça que ele mesmo arquivou.
  const arquivada = await buscarPorCodigoExato(limpo);
  if (arquivada) return { status: "arquivada", nome: arquivada.nome };

  return { status: "desconhecido", codigo: limpo };
}

export type ResultadoBipeEntrada =
  | { ok: true; produto: { id: string; nome: string; marca: string; sku: string; precoVenda: number; tipoVenda: "UNIDADE" | "FRACIONADO" } }
  | { ok: false; motivo: "desconhecido" | "arquivada" | "erro"; mensagem: string };

/**
 * Bipada no lançamento de pedido.
 *
 * Separada da venda porque a permissão é outra: aqui quem entra mercadoria é
 * quem mexe em estoque, não quem vende. Também não devolve estoque atual — na
 * entrada o que interessa é o que está chegando.
 */
export async function biparParaEntradaAction(codigo: string): Promise<ResultadoBipeEntrada> {
  try {
    await requireEscrita("estoque");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, motivo: "erro", mensagem: erro.message };
    throw erro;
  }

  const limpo = codigo.trim();
  if (!limpo) return { ok: false, motivo: "erro", mensagem: "Código vazio." };

  const produto = await buscarPorCodigoExato(limpo);
  if (!produto) {
    return { ok: false, motivo: "desconhecido", mensagem: `Código ${limpo} não está cadastrado.` };
  }
  if (!produto.ativo) {
    return {
      ok: false,
      motivo: "arquivada",
      mensagem: `${produto.nome} está arquivada. Reative antes de dar entrada — não cadastre de novo.`,
    };
  }

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
}

export type ResultadoConferencia =
  | { status: "livre" }
  | { status: "em_uso"; produtoId: string; nome: string; ativo: boolean }
  | { status: "erro"; mensagem: string };

/**
 * Confere, no cadastro, se o código bipado já pertence a alguma peça.
 *
 * `produtoIdAtual` existe para a tela de edição: relançar o mesmo código na
 * peça que já o tem não é conflito.
 */
export async function conferirCodigoAction(
  codigo: string,
  produtoIdAtual?: string
): Promise<ResultadoConferencia> {
  try {
    await requireEscrita("produtos");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { status: "erro", mensagem: erro.message };
    throw erro;
  }

  const limpo = codigo.trim();
  if (!limpo) return { status: "livre" };

  const produto = await buscarPorCodigoExato(limpo);
  if (!produto || produto.id === produtoIdAtual) return { status: "livre" };

  return { status: "em_uso", produtoId: produto.id, nome: produto.nome, ativo: produto.ativo };
}
