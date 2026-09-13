"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { alternarAtivoUsuario, criarUsuario } from "@/lib/usuarios";
import type { Papel } from "@prisma/client";

export type EstadoUsuario = { erro?: string };

export async function criarUsuarioAction(
  _estadoAnterior: EstadoUsuario,
  formData: FormData
): Promise<EstadoUsuario> {
  const usuarioLogado = await requireOwner();

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const papel = String(formData.get("papel") ?? "SELLER") as Papel;

  if (!nome || !email || senha.length < 6) {
    return { erro: "Preencha nome, e-mail e uma senha com pelo menos 6 caracteres." };
  }

  try {
    const usuario = await criarUsuario({ nome, email, senha, papel });
    await registrarAuditoria({
      usuarioId: usuarioLogado.id,
      acao: "usuario.criar",
      entidade: "Usuario",
      entidadeId: usuario.id,
      detalhes: `${nome} · ${papel}`,
    });
  } catch {
    return { erro: "Não foi possível criar o usuário. O e-mail já pode estar em uso." };
  }

  revalidatePath("/usuarios");
  return {};
}

export async function alternarAtivoUsuarioAction(usuarioId: string, ativo: boolean) {
  const usuarioLogado = await requireOwner();
  await alternarAtivoUsuario(usuarioId, ativo);
  await registrarAuditoria({
    usuarioId: usuarioLogado.id,
    acao: ativo ? "usuario.ativar" : "usuario.desativar",
    entidade: "Usuario",
    entidadeId: usuarioId,
  });
  revalidatePath("/usuarios");
}
