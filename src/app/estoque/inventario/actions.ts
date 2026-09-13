"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { aplicarContagemInventario, ErroEstoque, type ItemContagem } from "@/lib/estoque";

export type ResultadoContagem =
  | { ok: true; ajustes: Array<{ loteId: string; pool: "VENDA" | "DEMONSTRACAO"; delta: number }> }
  | { ok: false; erro: string };

export async function aplicarContagemInventarioAction(itens: ItemContagem[]): Promise<ResultadoContagem> {
  try {
    const usuario = await requireEscrita("estoque");
    const ajustes = await aplicarContagemInventario({ itens, usuarioId: usuario.id });
    if (ajustes.length > 0) {
      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "estoque.contagem_inventario",
        entidade: "Lote",
        detalhes: `${ajustes.length} ajuste(s) aplicado(s)`,
      });
    }
    revalidatePath("/estoque");
    revalidatePath("/estoque/lotes");
    revalidatePath("/estoque/inventario");
    revalidatePath("/produtos");
    revalidatePath("/dashboard");
    return { ok: true, ajustes };
  } catch (erro) {
    if (erro instanceof ErroEstoque || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível aplicar a contagem." };
  }
}
