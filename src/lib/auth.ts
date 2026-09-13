import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getSession } from "./session";
import type { SessaoUsuario } from "./types";

export type ResultadoLogin = { ok: true } | { ok: false; erro: string };

// Só pode ser chamado a partir de uma Server Action ou Route Handler (precisa gravar cookie).
export async function login(email: string, senha: string): Promise<ResultadoLogin> {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.ativo) {
    return { ok: false, erro: "E-mail ou senha inválidos." };
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaCorreta) {
    return { ok: false, erro: "E-mail ou senha inválidos." };
  }

  const session = await getSession();
  session.usuario = {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
  };
  await session.save();

  return { ok: true };
}

// Só pode ser chamado a partir de uma Server Action ou Route Handler.
export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

export async function usuarioAtual(): Promise<SessaoUsuario | undefined> {
  const session = await getSession();
  return session.usuario;
}

export async function requireUser(): Promise<SessaoUsuario> {
  const usuario = await usuarioAtual();
  if (!usuario) {
    redirect("/login");
  }
  return usuario;
}

export async function requireOwner(): Promise<SessaoUsuario> {
  const usuario = await requireUser();
  if (usuario.papel !== "OWNER") {
    redirect("/dashboard");
  }
  return usuario;
}
