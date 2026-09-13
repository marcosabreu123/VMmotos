"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { alterarAtivoInsumo, atualizarInsumo, criarInsumo, ErroInsumo, type DadosInsumo } from "@/lib/insumos";
import { reaisParaCentavos } from "@/lib/money";

export type EstadoInsumo = { erro?: string };

function lerDadosInsumo(formData: FormData): DadosInsumo | { erro: string } {
  const nome = String(formData.get("nome") ?? "").trim();
  const unidade = String(formData.get("unidade") ?? "").trim();
  if (!nome || !unidade) return { erro: "Preencha nome e unidade." };

  const custoUnitario = reaisParaCentavos(String(formData.get("custoUnitario") ?? "0"));
  if (!Number.isFinite(custoUnitario) || custoUnitario < 0) return { erro: "Informe um custo válido." };

  const estoqueAtualStr = String(formData.get("estoqueAtual") ?? "").trim();

  return { nome, unidade, custoUnitario, estoqueAtual: estoqueAtualStr ? Number(estoqueAtualStr) : null };
}

export async function criarInsumoAction(_estadoAnterior: EstadoInsumo, formData: FormData): Promise<EstadoInsumo> {
  let usuario;
  try {
    usuario = await requireEscrita("estoque");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const dados = lerDadosInsumo(formData);
  if ("erro" in dados) return dados;

  try {
    const insumo = await criarInsumo(dados);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "insumo.criar",
      entidade: "Insumo",
      entidadeId: insumo.id,
      detalhes: insumo.nome,
    });
  } catch (erro) {
    if (erro instanceof ErroInsumo) return { erro: erro.message };
    return { erro: "Não foi possível salvar o insumo." };
  }

  revalidatePath("/estoque/insumos");
  return {};
}

export async function atualizarInsumoAction(
  insumoId: string,
  _estadoAnterior: EstadoInsumo,
  formData: FormData
): Promise<EstadoInsumo> {
  let usuario;
  try {
    usuario = await requireEscrita("estoque");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const dados = lerDadosInsumo(formData);
  if ("erro" in dados) return dados;

  try {
    await atualizarInsumo(insumoId, dados);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "insumo.editar",
      entidade: "Insumo",
      entidadeId: insumoId,
      detalhes: dados.nome,
    });
  } catch (erro) {
    if (erro instanceof ErroInsumo) return { erro: erro.message };
    return { erro: "Não foi possível salvar o insumo." };
  }

  revalidatePath("/estoque/insumos");
  return {};
}

export async function alterarAtivoInsumoAction(insumoId: string, ativo: boolean) {
  const usuario = await requireEscrita("estoque");
  await alterarAtivoInsumo(insumoId, ativo);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: ativo ? "insumo.reativar" : "insumo.arquivar",
    entidade: "Insumo",
    entidadeId: insumoId,
  });
  revalidatePath("/estoque/insumos");
}
