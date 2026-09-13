"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  alterarAtivoProduto,
  atualizarFotoProduto,
  atualizarProduto,
  buscarProdutoPorId,
  criarProduto,
  type DadosProduto,
} from "@/lib/produtos";
import { salvarFotoProduto } from "@/lib/storage";
import { reaisParaCentavos } from "@/lib/money";
import type { TipoVenda } from "@prisma/client";

export type EstadoProduto = { erro?: string };

function lerDadosProduto(formData: FormData): DadosProduto | { erro: string } {
  const nome = String(formData.get("nome") ?? "").trim();
  const marca = String(formData.get("marca") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();

  if (!nome || !marca || !categoria || !sku) {
    return { erro: "Preencha nome, marca, categoria e SKU." };
  }

  const precoCustoRef = reaisParaCentavos(String(formData.get("precoCustoRef") ?? "0"));
  const precoVenda = reaisParaCentavos(String(formData.get("precoVenda") ?? "0"));
  if (!Number.isFinite(precoCustoRef) || !Number.isFinite(precoVenda) || precoVenda <= 0) {
    return { erro: "Informe preços válidos." };
  }

  const medidaStr = String(formData.get("medida") ?? "").trim();
  const codigoBarras = String(formData.get("codigoBarras") ?? "").trim();
  const fornecedorId = String(formData.get("fornecedorId") ?? "").trim();
  const atributoA = String(formData.get("atributoA") ?? "").trim();
  const estoqueMinimoStr = String(formData.get("estoqueMinimo") ?? "0");

  return {
    nome,
    marca,
    categoria,
    medida: medidaStr ? Number(medidaStr) : null,
    sku,
    codigoBarras: codigoBarras || null,
    precoCustoRef,
    precoVenda,
    fornecedorId: fornecedorId || null,
    atributoA: atributoA || null,
    atributoB: (String(formData.get("atributoB") ?? "UNISSEX") as string),
    tipoVenda: (String(formData.get("tipoVenda") ?? "UNIDADE") as TipoVenda),
    estoqueMinimo: Number(estoqueMinimoStr) || 0,
  };
}

export async function criarProdutoAction(
  _estadoAnterior: EstadoProduto,
  formData: FormData
): Promise<EstadoProduto> {
  let usuario;
  try {
    usuario = await requireEscrita("produtos");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const dados = lerDadosProduto(formData);
  if ("erro" in dados) return dados;

  let produtoId: string;
  try {
    const produto = await criarProduto(dados);
    produtoId = produto.id;
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "produto.criar",
      entidade: "Produto",
      entidadeId: produto.id,
      detalhes: produto.nome,
    });
  } catch {
    return { erro: "Não foi possível salvar. Confira se o SKU/código de barras já não está em uso." };
  }

  const foto = formData.get("foto");
  if (foto instanceof File && foto.size > 0) {
    const fotoPath = await salvarFotoProduto(produtoId, foto);
    await atualizarFotoProduto(produtoId, fotoPath);
  }

  revalidatePath("/produtos");
  redirect(`/produtos/${produtoId}`);
}

export async function atualizarProdutoAction(
  produtoId: string,
  _estadoAnterior: EstadoProduto,
  formData: FormData
): Promise<EstadoProduto> {
  let usuario;
  try {
    usuario = await requireEscrita("produtos");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const dados = lerDadosProduto(formData);
  if ("erro" in dados) return dados;

  const produtoAtual = await buscarProdutoPorId(produtoId);
  if (!produtoAtual) return { erro: "Produto não encontrado." };
  if (dados.tipoVenda !== produtoAtual.tipoVenda && produtoAtual.lotes.length > 0) {
    return { erro: "Não é possível mudar o tipo de venda de um produto que já tem lotes de estoque registrados." };
  }

  try {
    await atualizarProduto(produtoId, dados);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "produto.atualizar",
      entidade: "Produto",
      entidadeId: produtoId,
      detalhes: dados.nome,
    });
  } catch {
    return { erro: "Não foi possível salvar. Confira se o SKU/código de barras já não está em uso." };
  }

  const foto = formData.get("foto");
  if (foto instanceof File && foto.size > 0) {
    const fotoPath = await salvarFotoProduto(produtoId, foto);
    await atualizarFotoProduto(produtoId, fotoPath);
  }

  revalidatePath("/produtos");
  revalidatePath(`/produtos/${produtoId}`);
  redirect(`/produtos/${produtoId}`);
}

export async function alterarAtivoProdutoAction(produtoId: string, ativo: boolean) {
  const usuario = await requireEscrita("produtos");
  await alterarAtivoProduto(produtoId, ativo);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: ativo ? "produto.reativar" : "produto.arquivar",
    entidade: "Produto",
    entidadeId: produtoId,
  });
  revalidatePath("/produtos");
  revalidatePath(`/produtos/${produtoId}`);
}
