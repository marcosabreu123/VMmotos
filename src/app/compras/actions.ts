"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  criarPedido,
  atualizarPedido,
  enviarPedido,
  cancelarPedido,
  receberPedido,
  ErroCompra,
  type DadosPedido,
} from "@/lib/compras";

export type ItemRecebimentoForm = {
  itemPedidoId: string;
  numeroLote: string;
  dataValidade: string | null; // "YYYY-MM-DD" ou null
};

export type ResultadoAcaoCompra = { ok: true } | { ok: false; erro: string };

function revalidarPosCompra(pedidoId?: string) {
  revalidatePath("/compras");
  revalidatePath("/estoque");
  revalidatePath("/produtos");
  revalidatePath("/dashboard");
  if (pedidoId) revalidatePath(`/compras/${pedidoId}`);
}

export async function criarPedidoAction(
  dados: DadosPedido,
  enviarAoSalvar: boolean
): Promise<{ ok: true; pedidoId: string } | { ok: false; erro: string }> {
  try {
    const usuario = await requireEscrita("compras");

    const pedido = await criarPedido(dados);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "pedido.criar",
      entidade: "PedidoDeCompra",
      entidadeId: pedido.id,
    });
    if (enviarAoSalvar) {
      await enviarPedido(pedido.id);
      await registrarAuditoria({
        usuarioId: usuario.id,
        acao: "pedido.enviar",
        entidade: "PedidoDeCompra",
        entidadeId: pedido.id,
      });
    }
    revalidarPosCompra();
    return { ok: true, pedidoId: pedido.id };
  } catch (erro) {
    if (erro instanceof ErroCompra || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível salvar o pedido." };
  }
}

export async function atualizarPedidoAction(pedidoId: string, dados: DadosPedido): Promise<ResultadoAcaoCompra> {
  try {
    const usuario = await requireEscrita("compras");
    await atualizarPedido(pedidoId, dados);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "pedido.atualizar",
      entidade: "PedidoDeCompra",
      entidadeId: pedidoId,
    });
    revalidarPosCompra(pedidoId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroCompra || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível atualizar o pedido." };
  }
}

export async function enviarPedidoAction(pedidoId: string): Promise<ResultadoAcaoCompra> {
  try {
    const usuario = await requireEscrita("compras");
    await enviarPedido(pedidoId);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "pedido.enviar",
      entidade: "PedidoDeCompra",
      entidadeId: pedidoId,
    });
    revalidarPosCompra(pedidoId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroCompra || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível enviar o pedido." };
  }
}

export async function cancelarPedidoAction(pedidoId: string): Promise<ResultadoAcaoCompra> {
  try {
    const usuario = await requireEscrita("compras");
    await cancelarPedido(pedidoId);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "pedido.cancelar",
      entidade: "PedidoDeCompra",
      entidadeId: pedidoId,
    });
    revalidarPosCompra(pedidoId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroCompra || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível cancelar o pedido." };
  }
}

export async function receberPedidoAction(
  pedidoId: string,
  itens: ItemRecebimentoForm[]
): Promise<ResultadoAcaoCompra> {
  try {
    const usuario = await requireEscrita("compras");

    await receberPedido({
      pedidoId,
      usuarioId: usuario.id,
      itens: itens.map((item) => ({
        itemPedidoId: item.itemPedidoId,
        numeroLote: item.numeroLote,
        dataValidade: item.dataValidade ? new Date(`${item.dataValidade}T00:00:00`) : null,
      })),
    });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "pedido.receber",
      entidade: "PedidoDeCompra",
      entidadeId: pedidoId,
    });
    revalidarPosCompra(pedidoId);
    return { ok: true };
  } catch (erro) {
    if (erro instanceof ErroCompra || erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    return { ok: false, erro: "Não foi possível registrar o recebimento." };
  }
}
