"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  alterarStatusLote,
  transferirEstoque,
  registrarSaidaDemonstracao,
  ajustarEstoque,
  ErroEstoque,
  type SentidoTransferencia,
  type DadosAjuste,
} from "@/lib/estoque";

export type ResultadoAcaoEstoque = { ok: true } | { ok: false; erro: string };

function revalidarPosEstoque(loteId?: string) {
  revalidatePath("/estoque");
  revalidatePath("/estoque/lotes");
  revalidatePath("/produtos");
  revalidatePath("/dashboard");
  if (loteId) revalidatePath(`/estoque/lotes/${loteId}`);
}

export async function alterarStatusLoteAction(
  loteId: string,
  status: "ATIVO" | "BLOQUEADO"
): Promise<ResultadoAcaoEstoque> {
  try {
    const usuario = await requireEscrita("estoque");
    await alterarStatusLote(loteId, status);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: status === "BLOQUEADO" ? "lote.bloquear" : "lote.desbloquear",
      entidade: "Lote",
      entidadeId: loteId,
    });
    revalidarPosEstoque(loteId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroEstoque || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível alterar o status do lote." };
  }
}

export async function transferirEstoqueAction(params: {
  loteId: string;
  sentido: SentidoTransferencia;
  quantidade: number;
  observacao?: string | null;
}): Promise<ResultadoAcaoEstoque> {
  try {
    const usuario = await requireEscrita("estoque");
    await transferirEstoque({ ...params, usuarioId: usuario.id });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "estoque.transferir",
      entidade: "Lote",
      entidadeId: params.loteId,
      detalhes: `${params.sentido} · ${params.quantidade}`,
    });
    revalidarPosEstoque(params.loteId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroEstoque || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível transferir o estoque." };
  }
}

export async function registrarSaidaDemonstracaoAction(params: {
  loteId: string;
  quantidade: number;
  motivo: string;
}): Promise<ResultadoAcaoEstoque> {
  try {
    const usuario = await requireEscrita("estoque");
    await registrarSaidaDemonstracao({ ...params, usuarioId: usuario.id });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "estoque.saida_demonstracao",
      entidade: "Lote",
      entidadeId: params.loteId,
      detalhes: params.motivo,
    });
    revalidarPosEstoque(params.loteId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroEstoque || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível registrar a saída de demonstracao." };
  }
}

export async function ajustarEstoqueAction(
  dados: Omit<DadosAjuste, "usuarioId">
): Promise<ResultadoAcaoEstoque> {
  try {
    const usuario = await requireEscrita("estoque");
    await ajustarEstoque({ ...dados, usuarioId: usuario.id });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "estoque.ajuste",
      entidade: "Lote",
      entidadeId: dados.loteId,
      detalhes: `${dados.tipo} · ${dados.pool} · ${dados.quantidade} · ${dados.motivo}`,
    });
    revalidarPosEstoque(dados.loteId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroEstoque || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível aplicar o ajuste." };
  }
}
