"use server";

import { revalidatePath } from "next/cache";
import { requireDono, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { fecharMecanico, ErroFechamento } from "@/lib/oficina/fechamento";
import { centavosParaReais } from "@/lib/money";

export type ResultadoFechamento =
  | { ok: true; mensagem: string }
  | { ok: false; erro: string };

/**
 * Fecha e paga o que um mecânico tem a receber.
 *
 * Exige o dono: é pagamento de dinheiro, não operação de balcão.
 */
export async function fecharMecanicoAction(mecanicoId: string): Promise<ResultadoFechamento> {
  let usuario;
  try {
    usuario = await requireDono();
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    throw erro;
  }

  try {
    const { fechamento, mecanico, total, quantidade } = await fecharMecanico({
      mecanicoId,
      usuarioId: usuario.id,
    });

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "oficina.fechamento",
      entidade: "FechamentoRepasse",
      entidadeId: fechamento.id,
      detalhes: `${mecanico.nome}: ${quantidade} serviço(s)`,
      valorNovo: total,
    });

    revalidatePath("/oficina/comissoes");
    revalidatePath("/oficina/mecanicos");
    revalidatePath("/despesas");
    revalidatePath("/dashboard");
    revalidatePath("/relatorios");

    return {
      ok: true,
      mensagem: `Pago ${centavosParaReais(total)} a ${mecanico.nome}. A despesa foi lançada.`,
    };
  } catch (erro) {
    if (erro instanceof ErroFechamento) return { ok: false, erro: erro.message };
    throw erro;
  }
}
