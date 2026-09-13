"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  ajustarEstoquePorProduto,
  transferirParaDemonstracaoPorProduto,
  registrarSaidaDemonstracaoPorProduto,
  ErroEstoque,
  type SentidoTransferencia,
  type TipoAjuste,
} from "@/lib/estoque";

export type ResultadoAcaoEstoque = { ok: true } | { ok: false; erro: string };

function revalidarPosEstoque() {
  revalidatePath("/estoque");
  revalidatePath("/produtos");
  revalidatePath("/dashboard");
}

export async function ajustarEstoquePorProdutoAction(dados: {
  produtoId: string;
  pool: "VENDA" | "DEMONSTRACAO";
  tipo: TipoAjuste;
  quantidade: number;
  motivo: string;
}): Promise<ResultadoAcaoEstoque> {
  try {
    const usuario = await requireEscrita("estoque");
    await ajustarEstoquePorProduto({ ...dados, usuarioId: usuario.id });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "estoque.ajuste",
      entidade: "Produto",
      entidadeId: dados.produtoId,
      detalhes: `${dados.tipo} · ${dados.pool} · ${dados.quantidade} · ${dados.motivo}`,
    });
    revalidarPosEstoque();
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroEstoque || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível aplicar o ajuste." };
  }
}

export async function transferirDemonstracaoPorProdutoAction(dados: {
  produtoId: string;
  sentido: SentidoTransferencia;
  quantidade: number;
}): Promise<ResultadoAcaoEstoque> {
  try {
    const usuario = await requireEscrita("estoque");
    await transferirParaDemonstracaoPorProduto({ ...dados, usuarioId: usuario.id });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "estoque.transferir",
      entidade: "Produto",
      entidadeId: dados.produtoId,
      detalhes: `${dados.sentido} · ${dados.quantidade}`,
    });
    revalidarPosEstoque();
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroEstoque || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível transferir o estoque." };
  }
}

export async function registrarSaidaDemonstracaoPorProdutoAction(dados: {
  produtoId: string;
  quantidade: number;
  motivo: string;
}): Promise<ResultadoAcaoEstoque> {
  try {
    const usuario = await requireEscrita("estoque");
    await registrarSaidaDemonstracaoPorProduto({ ...dados, usuarioId: usuario.id });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "estoque.saida_demonstracao",
      entidade: "Produto",
      entidadeId: dados.produtoId,
      detalhes: dados.motivo,
    });
    revalidarPosEstoque();
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroEstoque || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível registrar a saída de demonstracao." };
  }
}
