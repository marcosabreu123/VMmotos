import { prisma } from "@/lib/db";

// Dedupe por requestId — clique duplicado, atualização de página ou retry de
// rede não devem reprocessar a mesma mensagem (nem, nas fases seguintes,
// duplicar uma escrita).
export async function buscarInteracaoPorRequestId(requestId: string) {
  return prisma.assistenteInteracao.findUnique({ where: { requestId } });
}
