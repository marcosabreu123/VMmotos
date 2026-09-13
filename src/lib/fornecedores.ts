import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import { tokensDeBusca, condicaoTokenFornecedor, juntarTokens } from "./busca";

export type DadosFornecedor = {
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  observacoes: string | null;
};

export async function listarFornecedores(busca?: string, apenasArquivados = false) {
  const buscaLimpa = busca?.trim();

  // Cada palavra é procurada separadamente, com unaccent e tolerância a erro
  // de digitação — ver src/lib/busca.ts.
  let idsCorrespondentes: string[] | undefined;
  if (buscaLimpa) {
    const condicoes = tokensDeBusca(buscaLimpa).map(condicaoTokenFornecedor);
    const correspondentes = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM "Fornecedor" WHERE ${juntarTokens(condicoes)}
    `);
    idsCorrespondentes = correspondentes.map((f) => f.id);
    if (idsCorrespondentes.length === 0) return [];
  }

  return prisma.fornecedor.findMany({
    where: {
      ativo: !apenasArquivados,
      ...(idsCorrespondentes ? { id: { in: idsCorrespondentes } } : {}),
    },
    orderBy: { nome: "asc" },
  });
}

export async function buscarFornecedorPorId(id: string) {
  return prisma.fornecedor.findUnique({ where: { id } });
}

export async function criarFornecedor(dados: DadosFornecedor) {
  return prisma.fornecedor.create({ data: dados });
}

export async function atualizarFornecedor(id: string, dados: DadosFornecedor) {
  return prisma.fornecedor.update({ where: { id }, data: dados });
}

export async function alterarAtivoFornecedor(id: string, ativo: boolean) {
  return prisma.fornecedor.update({ where: { id }, data: { ativo } });
}
