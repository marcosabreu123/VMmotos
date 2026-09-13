"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { alterarAtivoCliente, criarCliente, adicionarObservacaoCliente } from "@/lib/clientes";

export type EstadoCliente = { erro?: string };

export async function criarClienteAction(
  _estadoAnterior: EstadoCliente,
  formData: FormData
): Promise<EstadoCliente> {
  let usuario;
  try {
    usuario = await requireEscrita("clientes");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) {
    return { erro: "Informe o nome do cliente." };
  }

  const telefone = String(formData.get("telefone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  const cliente = await criarCliente({ nome, telefone: telefone || null, email: email || null });
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "cliente.criar",
    entidade: "Cliente",
    entidadeId: cliente.id,
    detalhes: cliente.nome,
  });

  revalidatePath("/clientes");
  return {};
}

// Usado pelo autocomplete da venda: cria e já retorna o cliente para selecionar na hora.
export async function criarClienteRapidoAction(nome: string, telefone: string) {
  const usuario = await requireEscrita("clientes");

  if (!nome.trim()) {
    throw new Error("Informe o nome do cliente.");
  }

  const cliente = await criarCliente({ nome: nome.trim(), telefone: telefone.trim() || null, email: null });
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "cliente.criar",
    entidade: "Cliente",
    entidadeId: cliente.id,
    detalhes: cliente.nome,
  });
  revalidatePath("/clientes");
  return { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone, totalCompras: 0 };
}

export async function alterarAtivoClienteAction(clienteId: string, ativo: boolean) {
  const usuario = await requireEscrita("clientes");
  await alterarAtivoCliente(clienteId, ativo);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: ativo ? "cliente.reativar" : "cliente.arquivar",
    entidade: "Cliente",
    entidadeId: clienteId,
  });
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);
}

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };

export async function adicionarObservacaoClienteAction(clienteId: string, observacoes: string): Promise<ResultadoAcao> {
  let usuario;
  try {
    usuario = await requireEscrita("clientes");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    throw erro;
  }

  await adicionarObservacaoCliente(clienteId, observacoes);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "cliente.observacao",
    entidade: "Cliente",
    entidadeId: clienteId,
  });
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}
