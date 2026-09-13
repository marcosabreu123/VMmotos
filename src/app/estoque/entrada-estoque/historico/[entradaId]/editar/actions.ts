"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { atualizarEntradaEstoque, ErroEntradaEstoque, type ItemEntradaEstoqueEdicao } from "@/lib/entradaEstoque";

export type DadosEdicaoForm = {
  fornecedorId: string | null;
  dataEntrada: string | null; // "YYYY-MM-DD"
  observacoes: string | null;
  valorFrete: number | null; // null = não alterar
  itens: ItemEntradaEstoqueEdicao[];
};

export type ResultadoEdicaoEntrada = { ok: true } | { ok: false; erro: string };

export async function atualizarEntradaEstoqueAction(
  entradaId: string,
  dados: DadosEdicaoForm
): Promise<ResultadoEdicaoEntrada> {
  try {
    const usuario = await requireEscrita("estoque");

    await atualizarEntradaEstoque(entradaId, {
      fornecedorId: dados.fornecedorId,
      dataEntrada: dados.dataEntrada ? new Date(`${dados.dataEntrada}T00:00:00`) : undefined,
      observacoes: dados.observacoes,
      valorFrete: dados.valorFrete ?? undefined,
      itens: dados.itens,
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "estoque.entrada_editar",
      entidade: "EntradaEstoque",
      entidadeId: entradaId,
    });

    revalidatePath("/estoque");
    revalidatePath("/estoque/entrada-estoque/historico");
    revalidatePath("/produtos");

    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroEntradaEstoque || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível atualizar a entrada de estoque." };
  }
}
