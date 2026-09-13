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

export async function criarTipoServico(nome: string, valorSugerido?: number | null) {
  const limpo = nome.trim();
  if (!limpo) throw new ErroTipoServico("Informe o nome do serviço.");

  if (valorSugerido !== undefined && valorSugerido !== null) {
    if (!Number.isInteger(valorSugerido) || valorSugerido < 0) {
      throw new ErroTipoServico("Valor sugerido inválido.");
    }
  }

  const existente = await prisma.tipoServico.findFirst({
    where: { nome: { equals: limpo, mode: "insensitive" } },
  });

  // Reaproveita em vez de recusar: se o tipo já existe (talvez arquivado), o
  // que o dono quer é usá-lo, não receber um erro no meio de uma venda.
  if (existente) {
    return prisma.tipoServico.update({
      where: { id: existente.id },
      data: {
        ativo: true,
        // Só sobrescreve o valor se veio um novo — recadastrar sem valor não
        // pode apagar o que já estava lá.
        ...(valorSugerido !== undefined && valorSugerido !== null ? { valorSugerido } : {}),
      },
    });
  }

  return prisma.tipoServico.create({
    data: { nome: limpo, valorSugerido: valorSugerido ?? null },
  });
}

export async function definirValorSugerido(id: string, valorSugerido: number | null) {
  if (valorSugerido !== null && (!Number.isInteger(valorSugerido) || valorSugerido < 0)) {
    throw new ErroTipoServico("Valor sugerido inválido.");
  }
  return prisma.tipoServico.update({ where: { id }, data: { valorSugerido } });
}

export async function arquivarTipoServico(id: string) {
  return prisma.tipoServico.update({ where: { id }, data: { ativo: false } });
}
