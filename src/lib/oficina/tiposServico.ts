import { prisma } from "../db";

/**
 * Catálogo de tipos de serviço da oficina.
 *
 * É só uma lista de nomes ("Troca de óleo", "Revisão", "Troca de relação"),
 * para o dono escolher em vez de digitar a mesma coisa toda vez. Não tem
 * preço: o valor é negociado caso a caso e digitado na venda.
 */

export class ErroTipoServico extends Error {}

export async function listarTiposServico() {
  return prisma.tipoServico.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });
}

export async function criarTipoServico(nome: string) {
  const limpo = nome.trim();
  if (!limpo) throw new ErroTipoServico("Informe o nome do serviço.");

  const existente = await prisma.tipoServico.findFirst({
    where: { nome: { equals: limpo, mode: "insensitive" } },
  });

  // Reaproveita em vez de recusar: se o tipo já existe (talvez arquivado), o
  // que o dono quer é usá-lo, não receber um erro no meio de uma venda.
  if (existente) {
    if (existente.ativo) return existente;
    return prisma.tipoServico.update({ where: { id: existente.id }, data: { ativo: true } });
  }

  return prisma.tipoServico.create({ data: { nome: limpo } });
}

export async function arquivarTipoServico(id: string) {
  return prisma.tipoServico.update({ where: { id }, data: { ativo: false } });
}
