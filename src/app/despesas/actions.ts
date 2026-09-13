"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  alterarAtivoCategoriaDespesa,
  alterarAtivoDespesa,
  anexarComprovante,
  atualizarDespesa,
  buscarDespesaPorId,
  cancelarDespesa,
  criarCategoriaDespesa,
  criarDespesa,
  criarDespesaRecorrente,
  duplicarDespesa,
  encerrarRecorrencia,
  ErroDespesa,
  marcarComoPaga,
  pausarRecorrencia,
  retomarRecorrencia,
  type DadosDespesa,
} from "@/lib/despesas";
import { salvarComprovanteDespesa } from "@/lib/storage";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";
import type { ClassificacaoDespesa, FormaPagamentoDespesa, TipoRecorrencia } from "@prisma/client";

export type EstadoDespesa = { erro?: string };

function lerDadosDespesa(formData: FormData): DadosDespesa | { erro: string } {
  const descricao = String(formData.get("descricao") ?? "").trim();
  const categoriaId = String(formData.get("categoriaId") ?? "").trim();
  const valorStr = String(formData.get("valor") ?? "");
  const dataDespesaStr = String(formData.get("dataDespesa") ?? "").trim();
  const classificacao = String(formData.get("classificacao") ?? "").trim() as ClassificacaoDespesa;

  if (!descricao || !categoriaId || !dataDespesaStr || !classificacao) {
    return { erro: "Preencha descrição, categoria, data e classificação." };
  }

  const valor = reaisParaCentavos(valorStr);
  if (!Number.isFinite(valor) || valor <= 0) {
    return { erro: "Informe um valor válido, maior que zero." };
  }

  const vencimentoStr = String(formData.get("vencimento") ?? "").trim();
  const fornecedorId = String(formData.get("fornecedorId") ?? "").trim();
  const formaPagamentoStr = String(formData.get("formaPagamento") ?? "").trim();
  const observacoes = String(formData.get("observacoes") ?? "").trim();

  return {
    descricao,
    categoriaId,
    fornecedorId: fornecedorId || null,
    valor,
    dataDespesa: new Date(dataDespesaStr),
    vencimento: vencimentoStr ? new Date(vencimentoStr) : null,
    formaPagamento: (formaPagamentoStr || null) as FormaPagamentoDespesa | null,
    classificacao,
    entraNoLucroLiquido: formData.get("entraNoLucroLiquido") === "on",
    observacoes: observacoes || null,
  };
}

async function tratarComprovante(despesaId: string, formData: FormData) {
  const arquivo = formData.get("comprovante");
  if (arquivo instanceof File && arquivo.size > 0) {
    const path = await salvarComprovanteDespesa(despesaId, arquivo);
    await anexarComprovante(despesaId, path);
  }
}

export async function criarDespesaAction(
  _estadoAnterior: EstadoDespesa,
  formData: FormData
): Promise<EstadoDespesa> {
  let usuario;
  try {
    usuario = await requireEscrita("despesas");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const dados = lerDadosDespesa(formData);
  if ("erro" in dados) return dados;

  const recorrencia = String(formData.get("recorrencia") ?? "NENHUMA") as TipoRecorrencia;

  let despesaId: string;
  try {
    const despesa =
      recorrencia === "NENHUMA"
        ? await criarDespesa(dados, usuario.id)
        : await criarDespesaRecorrente(dados, recorrencia, usuario.id);
    despesaId = despesa.id;
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "despesa.criar",
      entidade: "Despesa",
      entidadeId: despesa.id,
      detalhes: `${dados.descricao} · ${centavosParaReais(dados.valor)}`,
    });
  } catch (erro) {
    if (erro instanceof ErroDespesa) return { erro: erro.message };
    return { erro: "Não foi possível salvar a despesa." };
  }

  await tratarComprovante(despesaId, formData);

  revalidatePath("/despesas");
  redirect(`/despesas/${despesaId}`);
}

export async function atualizarDespesaAction(
  despesaId: string,
  _estadoAnterior: EstadoDespesa,
  formData: FormData
): Promise<EstadoDespesa> {
  let usuario;
  try {
    usuario = await requireEscrita("despesas");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const dados = lerDadosDespesa(formData);
  if ("erro" in dados) return dados;

  const escopo = formData.get("escopo") === "esta_e_futuras" ? "esta_e_futuras" : "somente_esta";

  try {
    const anterior = await buscarDespesaPorId(despesaId);
    await atualizarDespesa(despesaId, dados, escopo);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "despesa.editar",
      entidade: "Despesa",
      entidadeId: despesaId,
      detalhes: dados.descricao,
      valorAnterior: anterior?.valor !== dados.valor ? anterior?.valor : undefined,
      valorNovo: anterior?.valor !== dados.valor ? dados.valor : undefined,
    });
  } catch (erro) {
    if (erro instanceof ErroDespesa) return { erro: erro.message };
    return { erro: "Não foi possível salvar a despesa." };
  }

  await tratarComprovante(despesaId, formData);

  revalidatePath("/despesas");
  revalidatePath(`/despesas/${despesaId}`);
  redirect(`/despesas/${despesaId}`);
}

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

export async function marcarComoPagaAction(
  despesaId: string,
  dataPagamentoStr: string,
  formaPagamento?: FormaPagamentoDespesa
): Promise<ResultadoAcao> {
  let usuario;
  try {
    usuario = await requireEscrita("despesas");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    throw erro;
  }

  try {
    await marcarComoPaga(despesaId, new Date(dataPagamentoStr), formaPagamento);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "despesa.pagar",
      entidade: "Despesa",
      entidadeId: despesaId,
    });
  } catch (erro) {
    if (erro instanceof ErroDespesa) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível marcar como paga." };
  }

  revalidatePath("/despesas");
  revalidatePath(`/despesas/${despesaId}`);
  return { ok: true };
}

export async function cancelarDespesaAction(despesaId: string, motivo: string): Promise<ResultadoAcao> {
  let usuario;
  try {
    usuario = await requireEscrita("despesas");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    throw erro;
  }

  try {
    await cancelarDespesa(despesaId, usuario.id, motivo);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "despesa.cancelar",
      entidade: "Despesa",
      entidadeId: despesaId,
      detalhes: motivo,
    });
  } catch (erro) {
    if (erro instanceof ErroDespesa) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível cancelar a despesa." };
  }

  revalidatePath("/despesas");
  revalidatePath(`/despesas/${despesaId}`);
  return { ok: true };
}

export async function duplicarDespesaAction(despesaId: string) {
  const usuario = await requireEscrita("despesas");
  const nova = await duplicarDespesa(despesaId, usuario.id);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "despesa.duplicar",
    entidade: "Despesa",
    entidadeId: nova.id,
    detalhes: `Duplicada a partir de #${despesaId.slice(0, 8).toUpperCase()}`,
  });
  revalidatePath("/despesas");
  redirect(`/despesas/${nova.id}`);
}

export async function alterarAtivoDespesaAction(despesaId: string, ativo: boolean) {
  const usuario = await requireEscrita("despesas");
  await alterarAtivoDespesa(despesaId, ativo);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: ativo ? "despesa.reativar" : "despesa.arquivar",
    entidade: "Despesa",
    entidadeId: despesaId,
  });
  revalidatePath("/despesas");
  revalidatePath(`/despesas/${despesaId}`);
}

export async function pausarRecorrenciaAction(despesaId: string) {
  const usuario = await requireEscrita("despesas");
  await pausarRecorrencia(despesaId);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "despesa.recorrencia.pausar",
    entidade: "Despesa",
    entidadeId: despesaId,
  });
  revalidatePath(`/despesas/${despesaId}`);
}

export async function retomarRecorrenciaAction(despesaId: string) {
  const usuario = await requireEscrita("despesas");
  await retomarRecorrencia(despesaId);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "despesa.recorrencia.retomar",
    entidade: "Despesa",
    entidadeId: despesaId,
  });
  revalidatePath(`/despesas/${despesaId}`);
}

export async function encerrarRecorrenciaAction(despesaId: string) {
  const usuario = await requireEscrita("despesas");
  await encerrarRecorrencia(despesaId);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "despesa.recorrencia.encerrar",
    entidade: "Despesa",
    entidadeId: despesaId,
  });
  revalidatePath(`/despesas/${despesaId}`);
}

export type EstadoCategoria = { erro?: string };

export async function criarCategoriaDespesaAction(
  _estadoAnterior: EstadoCategoria,
  formData: FormData
): Promise<EstadoCategoria> {
  let usuario;
  try {
    usuario = await requireEscrita("despesas");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const nome = String(formData.get("nome") ?? "").trim();
  try {
    const categoria = await criarCategoriaDespesa(nome);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "categoriaDespesa.criar",
      entidade: "CategoriaDespesa",
      entidadeId: categoria.id,
      detalhes: categoria.nome,
    });
  } catch (erro) {
    if (erro instanceof ErroDespesa) return { erro: erro.message };
    return { erro: "Não foi possível criar a categoria. O nome já pode estar em uso." };
  }

  revalidatePath("/despesas/categorias");
  return {};
}

export async function alterarAtivoCategoriaDespesaAction(categoriaId: string, ativo: boolean) {
  const usuario = await requireEscrita("despesas");
  await alterarAtivoCategoriaDespesa(categoriaId, ativo);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: ativo ? "categoriaDespesa.reativar" : "categoriaDespesa.arquivar",
    entidade: "CategoriaDespesa",
    entidadeId: categoriaId,
  });
  revalidatePath("/despesas/categorias");
}
