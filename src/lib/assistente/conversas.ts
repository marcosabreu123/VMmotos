import { prisma } from "@/lib/db";

export async function criarConversa(usuarioId: string, titulo?: string) {
  return prisma.assistenteConversa.create({ data: { usuarioId, titulo: titulo ?? null } });
}

export async function listarConversas(usuarioId: string) {
  return prisma.assistenteConversa.findMany({
    where: { usuarioId, ativa: true },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}

export async function buscarConversaDoUsuario(conversaId: string, usuarioId: string) {
  return prisma.assistenteConversa.findFirst({ where: { id: conversaId, usuarioId } });
}

export async function encerrarConversa(conversaId: string, usuarioId: string) {
  return prisma.assistenteConversa.updateMany({
    where: { id: conversaId, usuarioId },
    data: { ativa: false },
  });
}

export async function listarHistoricoConversa(conversaId: string, limite = 10) {
  return prisma.assistenteInteracao.findMany({
    where: { conversaId },
    orderBy: { createdAt: "asc" },
    take: limite,
  });
}
