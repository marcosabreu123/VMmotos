"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { salvarPrecosEmMassa, ErroPreco, type AlteracaoPreco } from "@/lib/precos";

export type ResultadoPrecos =
  | { ok: true; alteradas: number }
  | { ok: false; erro: string };

export async function salvarPrecosAction(
  alteracoes: AlteracaoPreco[]
): Promise<ResultadoPrecos> {
  let usuario;
  try {
    usuario = await requireEscrita("produtos");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    throw erro;
  }

  try {
    const aplicadas = await salvarPrecosEmMassa(alteracoes);

    // Uma linha de auditoria por peça alterada: preço é o número que mais
    // gera dúvida depois ("por que essa peça está nesse valor?"), então o
    // registro guarda o antes e o depois de cada uma.
    for (const a of aplicadas) {
      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "produto.preco_massa",
        entidade: "Produto",
        entidadeId: a.produtoId,
        detalhes: `${a.nome}: custo ${a.custoAntes} → ${a.custoDepois}, venda ${a.vendaAntes} → ${a.vendaDepois}`,
        valorAnterior: a.vendaAntes,
        valorNovo: a.vendaDepois,
      });
    }

    revalidatePath("/produtos/precos");
    revalidatePath("/produtos");
    return { ok: true, alteradas: aplicadas.length };
  } catch (erro) {
    if (erro instanceof ErroPreco) return { ok: false, erro: erro.message };
    throw erro;
  }
}
