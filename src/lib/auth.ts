import bcrypt from "bcryptjs";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getSession } from "./session";
import type { SessaoUsuario } from "./types";
import { ehAdministrador } from "./permissoes";

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

/**
 * Quem está logado AGORA, conferido no banco.
 *
 * O cookie de sessão guarda nome e papel do momento do login. Se ele fosse a
 * palavra final, mudar o papel de alguém (ou desativar a pessoa) só teria
 * efeito quando ela resolvesse deslogar — um usuário rebaixado continuaria
 * com o acesso antigo, e um desativado continuaria entrando. Por isso o
 * cookie serve só para dizer QUEM é; o que essa pessoa pode vem do banco.
 *
 * `cache` do React dedupe a consulta dentro da mesma requisição: uma página
 * que chama requireUser e mais duas checagens de permissão faz uma busca só.
 */
export const usuarioAtual = cache(async (): Promise<SessaoUsuario | undefined> => {
  const session = await getSession();
  if (!session.usuario) return undefined;

  const atual = await prisma.usuario.findUnique({
    where: { id: session.usuario.id },
    select: { id: true, nome: true, email: true, papel: true, ativo: true },
  });

  // Conta apagada ou desativada perde o acesso na hora.
  if (!atual || !atual.ativo) return undefined;

  return { id: atual.id, nome: atual.nome, email: atual.email, papel: atual.papel };
});

export async function requireUser(): Promise<SessaoUsuario> {
  const usuario = await usuarioAtual();
  if (!usuario) {
    redirect("/login");
  }
  return usuario;
}

export async function requireOwner(): Promise<SessaoUsuario> {
  const usuario = await requireUser();
  if (!ehAdministrador(usuario.papel)) {
    redirect("/dashboard");
  }
  return usuario;
}
