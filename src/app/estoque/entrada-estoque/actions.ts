"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { registrarEntradaEstoque, ErroEntradaEstoque } from "@/lib/entradaEstoque";
import { centavosParaReais } from "@/lib/money";

export type ItemEntradaForm = {
  produtoId: string;
  quantidade: number;
  custoUnitario: number; // centavos
};

export type DadosEntradaForm = {
  fornecedorId: string | null;
  dataEntrada: string | null; // "YYYY-MM-DD" ou null (usa agora)
  itens: ItemEntradaForm[];
  valorFrete: number; // centavos
  observacoes: string | null;
};

export type ResultadoEntradaEstoque = { ok: true; entradaId: string } | { ok: false; erro: string };

export async function registrarEntradaEstoqueAction(dados: DadosEntradaForm): Promise<ResultadoEntradaEstoque> {
  try {
    const usuario = await requireEscrita("estoque");

    const entrada = await registrarEntradaEstoque({
      fornecedorId: dados.fornecedorId,
      dataEntrada: dados.dataEntrada ? new Date(`${dados.dataEntrada}T00:00:00`) : undefined,
      itens: dados.itens,
      valorFrete: dados.valorFrete,
      observacoes: dados.observacoes,
      usuarioId: usuario.id,
    });

    const quantidadeTotal = dados.itens.reduce((soma, item) => soma + item.quantidade, 0);
    const valorTotal = dados.itens.reduce((soma, item) => soma + item.quantidade * item.custoUnitario, 0) + dados.valorFrete;
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "estoque.entrada",
      entidade: "EntradaEstoque",
      entidadeId: entrada.id,
      detalhes: `${dados.itens.length} produto(s), ${quantidadeTotal} un., total ${centavosParaReais(valorTotal)}`,
    });

    revalidatePath("/estoque");
    revalidatePath("/estoque/entrada-estoque/historico");
    revalidatePath("/produtos");
    revalidatePath("/dashboard");

    return { ok: true, entradaId: entrada.id };
  } catch (erro) {
    if (erro instanceof ErroEntradaEstoque || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível registrar a entrada de estoque." };
  }
}
