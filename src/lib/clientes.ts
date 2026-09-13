import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import { tokensDeBusca, condicaoTokenCliente, relevanciaCliente, juntarTokens } from "./busca";

export async function buscarClientes(termo: string) {
  const termoLimpo = termo.trim();
  if (!termoLimpo) return [];

  // Cada palavra é procurada separadamente, com unaccent e tolerância a erro
  // de digitação — "pedro silva" encontra "Pedro da Silva". Ver src/lib/busca.ts.
  const condicoes = tokensDeBusca(termoLimpo).map(condicaoTokenCliente);
  const correspondentes = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM "Cliente"
    WHERE ativo = true AND ${juntarTokens(condicoes)}
    ORDER BY ${relevanciaCliente(termoLimpo)} DESC, nome ASC
    LIMIT 10
  `);
  if (correspondentes.length === 0) return [];

  const ordem = correspondentes.map((c) => c.id);
  const encontrados = await prisma.cliente.findMany({
    where: { id: { in: ordem } },
    include: { _count: { select: { vendas: true } } },
  });
  // preserva a ordem de relevância do SQL, que o `in` não garante
  const clientes = ordem
    .map((id) => encontrados.find((c) => c.id === id))
    .filter((c): c is (typeof encontrados)[number] => c !== undefined);

  return clientes.map((cliente) => ({
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    totalCompras: cliente._count.vendas,
  }));
}

export async function criarCliente(dados: { nome: string; telefone: string | null; email: string | null }) {
  return prisma.cliente.create({ data: dados });
}

export async function listarClientes(busca?: string, apenasArquivados = false) {
  return prisma.cliente.findMany({
    where: {
      ativo: !apenasArquivados,
      ...(busca ? { OR: [{ nome: { contains: busca, mode: "insensitive" } }, { telefone: { contains: busca } }] } : {}),
    },
    orderBy: { nome: "asc" },
  });
}

export async function alterarAtivoCliente(id: string, ativo: boolean) {
  return prisma.cliente.update({ where: { id }, data: { ativo } });
}

export async function atualizarCliente(
  id: string,
  dados: { nome: string; telefone: string | null; email: string | null; observacoes?: string | null }
) {
  return prisma.cliente.update({ where: { id }, data: dados });
}

export async function adicionarObservacaoCliente(id: string, observacoes: string) {
  return prisma.cliente.update({ where: { id }, data: { observacoes } });
}

export async function buscarClientePorId(id: string) {
  return prisma.cliente.findUnique({
    where: { id },
    include: {
      vendas: {
        orderBy: { dataHora: "desc" },
        include: { itens: { include: { produto: true } } },
      },
    },
  });
}
