"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  registrarVenda,
  cancelarVenda,
  registrarDevolucao,
  adicionarObservacaoVenda,
  corrigirClienteVenda,
  registrarPagamentoVenda,
  ErroVenda,
  type ItemCarrinho,
  type DadosItemDevolucao,
} from "@/lib/vendas";
import { registrarUsoInsumos, ErroInsumo, type ItemInsumoUso } from "@/lib/insumos";
import type { FormaPagamento } from "@prisma/client";

export type ResultadoFinalizarVenda =
  | { ok: true; vendaId: string; total: number }
  | { ok: false; erro: string };

export type DadosFinalizarVenda = {
  itens: ItemCarrinho[];
  formaPagamento: FormaPagamento;
  descontoTotal: number;
  acrescimoTotal?: number;
  clienteId?: string | null;
  dataVenda?: string | null; // "YYYY-MM-DD"; vazio/omitido usa o momento atual
  valorPago?: number; // centavos; omitido = total (pago integralmente)
};

export async function finalizarVendaAction(dados: DadosFinalizarVenda): Promise<ResultadoFinalizarVenda> {
  try {
    const usuario = await requireEscrita("vendas");

    const venda = await registrarVenda({
      itens: dados.itens,
      formaPagamento: dados.formaPagamento,
      descontoTotal: dados.descontoTotal,
      acrescimoTotal: dados.acrescimoTotal,
      clienteId: dados.clienteId,
      usuarioId: usuario.id,
      dataHora: dados.dataVenda ? new Date(`${dados.dataVenda}T00:00:00`) : undefined,
      valorPago: dados.valorPago,
    });

    revalidatePath("/estoque");
    revalidatePath("/relatorios");
    revalidatePath("/produtos");
    revalidatePath("/clientes");

    return { ok: true, vendaId: venda.id, total: venda.total };
  } catch (erro) {
    if (erro instanceof ErroVenda || erro instanceof ErroPermissao) {
      return { ok: false, erro: erro.message };
    }
    return { ok: false, erro: "Não foi possível registrar a venda. Tente novamente." };
  }
}

export type ResultadoAcaoVenda = { ok: true } | { ok: false; erro: string };

function revalidarPosVenda(vendaId: string) {
  revalidatePath("/estoque");
  revalidatePath("/relatorios");
  revalidatePath("/produtos");
  revalidatePath("/dashboard");
  revalidatePath("/vendas");
  revalidatePath("/vendas/historico");
  revalidatePath(`/vendas/${vendaId}`);
}

export async function registrarPagamentoVendaAction(vendaId: string, valor: number): Promise<ResultadoAcaoVenda> {
  try {
    const usuario = await requireEscrita("vendas");
    await registrarPagamentoVenda({ vendaId, valor });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "venda.pagamento_registrar",
      entidade: "Venda",
      entidadeId: vendaId,
      valorNovo: valor,
    });
    revalidarPosVenda(vendaId);
    revalidatePath("/clientes/debitos");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroVenda || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível registrar o pagamento." };
  }
}

export async function cancelarVendaAction(vendaId: string, motivo: string): Promise<ResultadoAcaoVenda> {
  try {
    const usuario = await requireEscrita("vendas");
    await cancelarVenda({ vendaId, usuarioId: usuario.id, motivo });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "venda.cancelar",
      entidade: "Venda",
      entidadeId: vendaId,
      detalhes: motivo,
    });
    revalidarPosVenda(vendaId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroVenda || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível cancelar a venda." };
  }
}

export async function registrarDevolucaoAction(
  vendaId: string,
  motivo: string,
  itens: DadosItemDevolucao[]
): Promise<ResultadoAcaoVenda> {
  try {
    const usuario = await requireEscrita("vendas");
    await registrarDevolucao({ vendaId, usuarioId: usuario.id, motivo, itens });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "venda.devolucao",
      entidade: "Venda",
      entidadeId: vendaId,
      detalhes: motivo,
    });
    revalidarPosVenda(vendaId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroVenda || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível registrar a devolução." };
  }
}

export async function adicionarObservacaoAction(vendaId: string, observacoes: string): Promise<ResultadoAcaoVenda> {
  try {
    await requireEscrita("vendas");
    await adicionarObservacaoVenda(vendaId, observacoes);
    revalidatePath(`/vendas/${vendaId}`);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível salvar a observação." };
  }
}

export async function registrarUsoInsumosAction(vendaId: string, itens: ItemInsumoUso[]): Promise<ResultadoAcaoVenda> {
  let usuario;
  try {
    usuario = await requireEscrita("vendas");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    throw erro;
  }

  try {
    await registrarUsoInsumos(vendaId, itens);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "venda.insumo.registrar",
      entidade: "Venda",
      entidadeId: vendaId,
      detalhes: `${itens.length} insumo(s)`,
    });
    revalidatePath(`/vendas/${vendaId}`);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroInsumo) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível registrar o uso de insumos." };
  }
}

export async function corrigirClienteVendaAction(
  vendaId: string,
  clienteId: string | null
): Promise<ResultadoAcaoVenda> {
  try {
    await requireEscrita("vendas");
    await corrigirClienteVenda(vendaId, clienteId);
    revalidatePath(`/vendas/${vendaId}`);
    revalidatePath("/clientes");
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível corrigir o cliente." };
  }
}
