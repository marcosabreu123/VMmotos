"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { alterarAtivoFornecedor, atualizarFornecedor, criarFornecedor } from "@/lib/fornecedores";

export type EstadoFornecedor = { erro?: string };

type DadosFornecedorForm = {
  nome: string;
  erro?: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  observacoes: string | null;
};

function lerDadosFornecedor(formData: FormData): DadosFornecedorForm {
  const nome = String(formData.get("nome") ?? "").trim();
  return {
    nome,
    erro: nome ? undefined : "Informe o nome do fornecedor.",
    documento: campoOpcional(formData, "documento"),
    telefone: campoOpcional(formData, "telefone"),
    email: campoOpcional(formData, "email"),
    endereco: campoOpcional(formData, "endereco"),
    observacoes: campoOpcional(formData, "observacoes"),
  };
}

export async function criarFornecedorAction(
  _estadoAnterior: EstadoFornecedor,
  formData: FormData
): Promise<EstadoFornecedor> {
  let usuario;
  try {
    usuario = await requireEscrita("fornecedores");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const dados = lerDadosFornecedor(formData);
  if (dados.erro) return { erro: dados.erro };

  const fornecedor = await criarFornecedor({
    nome: dados.nome,
    documento: dados.documento,
    telefone: dados.telefone,
    email: dados.email,
    endereco: dados.endereco,
    observacoes: dados.observacoes,
  });
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "fornecedor.criar",
    entidade: "Fornecedor",
    entidadeId: fornecedor.id,
    detalhes: fornecedor.nome,
  });

  revalidatePath("/fornecedores");
  redirect("/fornecedores");
}

export async function atualizarFornecedorAction(
  fornecedorId: string,
  _estadoAnterior: EstadoFornecedor,
  formData: FormData
): Promise<EstadoFornecedor> {
  let usuario;
  try {
    usuario = await requireEscrita("fornecedores");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const dados = lerDadosFornecedor(formData);
  if (dados.erro) return { erro: dados.erro };

  await atualizarFornecedor(fornecedorId, {
    nome: dados.nome,
    documento: dados.documento,
    telefone: dados.telefone,
    email: dados.email,
    endereco: dados.endereco,
    observacoes: dados.observacoes,
  });
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "fornecedor.atualizar",
    entidade: "Fornecedor",
    entidadeId: fornecedorId,
    detalhes: dados.nome,
  });

  revalidatePath("/fornecedores");
  redirect("/fornecedores");
}

export async function alterarAtivoFornecedorAction(fornecedorId: string, ativo: boolean) {
  const usuario = await requireEscrita("fornecedores");
  await alterarAtivoFornecedor(fornecedorId, ativo);
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: ativo ? "fornecedor.reativar" : "fornecedor.arquivar",
    entidade: "Fornecedor",
    entidadeId: fornecedorId,
  });
  revalidatePath("/fornecedores");
  revalidatePath(`/fornecedores/${fornecedorId}/editar`);
}

function campoOpcional(formData: FormData, campo: string): string | null {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor || null;
}
