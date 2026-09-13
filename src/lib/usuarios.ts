import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Papel } from "@prisma/client";

export async function listarUsuarios() {
  return prisma.usuario.findMany({ orderBy: { nome: "asc" } });
}

export async function criarUsuario(dados: { nome: string; email: string; senha: string; papel: Papel }) {
  const senhaHash = await bcrypt.hash(dados.senha, 10);
  return prisma.usuario.create({
    data: { nome: dados.nome, email: dados.email, senhaHash, papel: dados.papel },
  });
}

export async function alternarAtivoUsuario(id: string, ativo: boolean) {
  return prisma.usuario.update({ where: { id }, data: { ativo } });
}
