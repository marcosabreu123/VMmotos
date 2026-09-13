"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  alterarAtivoProduto,
  atualizarProduto,
  buscarProdutoPorSku,
  criarProduto,
  type DadosProduto,
} from "@/lib/produtos";
import { listarFornecedores } from "@/lib/fornecedores";
import { parsearCsv } from "@/lib/csv";
import { reaisParaCentavos } from "@/lib/money";
import type { TipoVenda } from "@prisma/client";
import { nicho } from "@/config/nicho";

const OPCOES_ATRIBUTO_B: string[] = nicho.atributos.atributoB.opcoes.map((o) => o.valor);

// Casa o valor da planilha com uma opção configurada, ignorando caixa. Lista de
// opções vazia = atributo de texto livre, aí entra o que veio no arquivo.
function resolverAtributoB(bruto: string): string | null {
  if (!bruto) return null;
  if (OPCOES_ATRIBUTO_B.length === 0) return bruto;
  return OPCOES_ATRIBUTO_B.find((o) => o.toLowerCase() === bruto.toLowerCase()) ?? null;
}
const TIPOS_VENDA: TipoVenda[] = ["UNIDADE", "FRACIONADO"];
const COLUNAS_OBRIGATORIAS = ["nome", "marca", "categoria", "sku", "precovenda"];

export type EstadoImportacao = {
  erro?: string;
  resumo?: { total: number; sucesso: number; comAviso: number; avisos: string[] };
};

export async function importarProdutosAction(
  _estadoAnterior: EstadoImportacao,
  formData: FormData
): Promise<EstadoImportacao> {
  let usuario;
  try {
    usuario = await requireEscrita("produtos");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Selecione um arquivo CSV." };
  }

  const linhas = parsearCsv(await arquivo.text());
  if (linhas.length < 2) {
    return { erro: "Arquivo vazio ou sem linhas de dados." };
  }

  const cabecalho = linhas[0].map((coluna) => coluna.trim().toLowerCase());
  const idx = (coluna: string) => cabecalho.indexOf(coluna);

  if (COLUNAS_OBRIGATORIAS.some((coluna) => idx(coluna) === -1)) {
    return {
      erro: "Cabeçalho inválido. Colunas obrigatórias: nome, marca, categoria, sku, precoVenda.",
    };
  }

  const idxNome = idx("nome");
  const idxMarca = idx("marca");
  const idxCategoria = idx("categoria");
  const idxSku = idx("sku");
  const idxPrecoVenda = idx("precovenda");
  const idxMedida = idx("medida");
  const idxCodigoBarras = idx("codigobarras");
  const idxPrecoCusto = idx("precocustoref");
  const idxFornecedor = idx("fornecedor");
  const idxAtributoA = idx("atributoa");
  const idxAtributoB = idx("atributob");
  const idxTipoVenda = idx("tipovenda");
  const idxEstoqueMinimo = idx("estoqueminimo");
  const idxAtivo = idx("ativo");

  const fornecedores = await listarFornecedores();
  const fornecedorPorNome = new Map(fornecedores.map((f) => [f.nome.trim().toLowerCase(), f.id]));

  const avisos: string[] = [];
  let sucesso = 0;

  for (let numeroLinha = 1; numeroLinha < linhas.length; numeroLinha++) {
    const linha = linhas[numeroLinha];
    const campo = (indice: number) => (indice >= 0 ? (linha[indice] ?? "").trim() : "");
    const referencia = `Linha ${numeroLinha + 1}`;

    const nome = campo(idxNome);
    const marca = campo(idxMarca);
    const categoria = campo(idxCategoria);
    const sku = campo(idxSku);
    const precoVendaStr = campo(idxPrecoVenda);

    if (!nome || !marca || !categoria || !sku || !precoVendaStr) {
      avisos.push(`${referencia}: faltam campos obrigatórios — linha ignorada.`);
      continue;
    }

    const precoVenda = reaisParaCentavos(precoVendaStr);
    if (!Number.isFinite(precoVenda) || precoVenda <= 0) {
      avisos.push(`${referencia}: preço de venda inválido — linha ignorada.`);
      continue;
    }

    const atributoBStr = campo(idxAtributoB);
    const tipoVendaStr = campo(idxTipoVenda).toUpperCase();

    let fornecedorId: string | null = null;
    const fornecedorNome = campo(idxFornecedor);
    if (fornecedorNome) {
      fornecedorId = fornecedorPorNome.get(fornecedorNome.toLowerCase()) ?? null;
      if (!fornecedorId) {
        avisos.push(`${referencia}: fornecedor "${fornecedorNome}" não encontrado — produto importado sem fornecedor.`);
      }
    }

    const medidaStr = campo(idxMedida);
    const estoqueMinimoStr = campo(idxEstoqueMinimo);
    const ativoStr = campo(idxAtivo).toLowerCase();

    const dados: DadosProduto = {
      nome,
      marca,
      categoria,
      medida: medidaStr ? Number(medidaStr) : null,
      sku,
      codigoBarras: campo(idxCodigoBarras) || null,
      precoCustoRef: idxPrecoCusto >= 0 ? reaisParaCentavos(campo(idxPrecoCusto) || "0") : 0,
      precoVenda,
      fornecedorId,
      atributoA: campo(idxAtributoA) || null,
      atributoB: resolverAtributoB(atributoBStr),
      tipoVenda: TIPOS_VENDA.includes(tipoVendaStr as TipoVenda) ? (tipoVendaStr as TipoVenda) : "UNIDADE",
      estoqueMinimo: Number(estoqueMinimoStr) || 0,
    };
    const ativo = idxAtivo >= 0 ? ["sim", "true", "1"].includes(ativoStr) : true;

    try {
      const existente = await buscarProdutoPorSku(sku);
      const produtoId = existente ? existente.id : (await criarProduto(dados)).id;
      if (existente) await atualizarProduto(existente.id, dados);
      if (idxAtivo >= 0 && ativo !== (existente?.ativo ?? true)) {
        await alterarAtivoProduto(produtoId, ativo);
      }
      sucesso++;
    } catch {
      avisos.push(`${referencia}: erro ao salvar (SKU ou código de barras já em uso por outro produto?) — linha ignorada.`);
    }
  }

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "produtos.importar_planilha",
    entidade: "Produto",
    detalhes: `${sucesso} de ${linhas.length - 1} linha(s) importada(s) com sucesso`,
  });

  revalidatePath("/produtos");

  return {
    resumo: {
      total: linhas.length - 1,
      sucesso,
      comAviso: avisos.length,
      avisos,
    },
  };
}
