import { prisma } from "./db";
import { Prisma } from "@prisma/client";
import type { ClassificacaoDespesa, FormaPagamentoDespesa, StatusDespesa, TipoRecorrencia } from "@prisma/client";

export class ErroDespesa extends Error {}

export type DadosDespesa = {
  descricao: string;
  categoriaId: string;
  fornecedorId?: string | null;
  valor: number; // centavos
  dataDespesa: Date;
  vencimento?: Date | null;
  formaPagamento?: FormaPagamentoDespesa | null;
  classificacao: ClassificacaoDespesa;
  entraNoLucroLiquido?: boolean;
  observacoes?: string | null;
};

export type StatusEfetivo = "pendente" | "pago" | "vencido" | "cancelado";

// "Vencido" nunca é gravado no banco — é sempre derivado em tempo de leitura,
// tanto aqui quanto na tradução do filtro `status=vencido` em listarDespesas().
export function statusEfetivoDespesa(
  despesa: { status: StatusDespesa; vencimento: Date | null },
  agora = new Date()
): StatusEfetivo {
  if (despesa.status === "PAGO") return "pago";
  if (despesa.status === "CANCELADO") return "cancelado";
  if (despesa.vencimento && despesa.vencimento < agora) return "vencido";
  return "pendente";
}

function proximaData(data: Date, recorrencia: TipoRecorrencia): Date {
  const proxima = new Date(data);
  if (recorrencia === "SEMANAL") proxima.setDate(proxima.getDate() + 7);
  else if (recorrencia === "MENSAL") proxima.setMonth(proxima.getMonth() + 1);
  else if (recorrencia === "TRIMESTRAL") proxima.setMonth(proxima.getMonth() + 3);
  else if (recorrencia === "SEMESTRAL") proxima.setMonth(proxima.getMonth() + 6);
  else if (recorrencia === "ANUAL") proxima.setFullYear(proxima.getFullYear() + 1);
  return proxima;
}

export async function criarDespesa(dados: DadosDespesa, usuarioId: string) {
  if (dados.valor <= 0) throw new ErroDespesa("Informe um valor maior que zero.");
  return prisma.despesa.create({ data: { ...dados, usuarioId } });
}

export async function criarDespesaRecorrente(
  dados: DadosDespesa,
  recorrencia: Exclude<TipoRecorrencia, "NENHUMA">,
  usuarioId: string
) {
  if (dados.valor <= 0) throw new ErroDespesa("Informe um valor maior que zero.");
  return prisma.despesa.create({
    data: { ...dados, usuarioId, recorrencia, statusRecorrencia: "ATIVA" },
  });
}

// Idempotente: chamada sempre que a lista de despesas é aberta. A trava real contra
// duplicidade é o @@unique([despesaOrigemId, dataDespesa]) no banco — erros de
// constraint (corrida entre requisições concorrentes) são engolidos silenciosamente.
export async function gerarOcorrenciasPendentes(): Promise<void> {
  const hoje = new Date();

  const templates = await prisma.despesa.findMany({
    where: { despesaOrigemId: null, statusRecorrencia: "ATIVA", recorrencia: { not: "NENHUMA" } },
    include: { ocorrencias: { orderBy: { dataDespesa: "desc" }, take: 1 } },
  });

  for (const template of templates) {
    let ultimaData = template.ocorrencias[0]?.dataDespesa ?? template.dataDespesa;
    let proxima = proximaData(ultimaData, template.recorrencia);

    while (proxima <= hoje) {
      const offsetVencimento =
        template.vencimento && template.dataDespesa
          ? template.vencimento.getTime() - template.dataDespesa.getTime()
          : null;

      try {
        await prisma.despesa.create({
          data: {
            descricao: template.descricao,
            categoriaId: template.categoriaId,
            fornecedorId: template.fornecedorId,
            valor: template.valor,
            dataDespesa: proxima,
            vencimento: offsetVencimento !== null ? new Date(proxima.getTime() + offsetVencimento) : null,
            formaPagamento: template.formaPagamento,
            classificacao: template.classificacao,
            entraNoLucroLiquido: template.entraNoLucroLiquido,
            usuarioId: template.usuarioId,
            despesaOrigemId: template.id,
          },
        });
      } catch (erro) {
        // P2002 = violação de unique constraint — já existe essa ocorrência, ignora.
        if (!(erro instanceof Prisma.PrismaClientKnownRequestError) || erro.code !== "P2002") throw erro;
      }

      ultimaData = proxima;
      proxima = proximaData(ultimaData, template.recorrencia);
    }
  }
}

type Escopo = "somente_esta" | "esta_e_futuras";

export async function atualizarDespesa(id: string, dados: DadosDespesa, escopo: Escopo = "somente_esta") {
  const despesaAtual = await prisma.despesa.findUnique({ where: { id } });
  if (!despesaAtual) throw new ErroDespesa("Despesa não encontrada.");
  if (despesaAtual.status === "PAGO") {
    throw new ErroDespesa("Não é possível editar uma despesa já paga. Cancele e crie uma nova, se necessário.");
  }
  if (dados.valor <= 0) throw new ErroDespesa("Informe um valor maior que zero.");

  if (escopo === "somente_esta") {
    return prisma.despesa.update({ where: { id }, data: dados });
  }

  const familiaId = despesaAtual.despesaOrigemId ?? despesaAtual.id;
  await prisma.despesa.updateMany({
    where: {
      OR: [{ id: familiaId }, { despesaOrigemId: familiaId }],
      dataDespesa: { gte: despesaAtual.dataDespesa },
      status: { not: "PAGO" },
    },
    data: {
      descricao: dados.descricao,
      categoriaId: dados.categoriaId,
      fornecedorId: dados.fornecedorId,
      valor: dados.valor,
      formaPagamento: dados.formaPagamento,
      classificacao: dados.classificacao,
      entraNoLucroLiquido: dados.entraNoLucroLiquido,
      observacoes: dados.observacoes,
    },
  });
  return prisma.despesa.findUniqueOrThrow({ where: { id } });
}

export async function marcarComoPaga(id: string, dataPagamento: Date, formaPagamento?: FormaPagamentoDespesa) {
  const despesa = await prisma.despesa.findUnique({ where: { id } });
  if (!despesa) throw new ErroDespesa("Despesa não encontrada.");
  if (despesa.status === "CANCELADO") throw new ErroDespesa("Uma despesa cancelada não pode ser marcada como paga.");

  return prisma.despesa.update({
    where: { id },
    data: { status: "PAGO", dataPagamento, formaPagamento: formaPagamento ?? despesa.formaPagamento },
  });
}

export async function cancelarDespesa(id: string, usuarioId: string, motivo: string) {
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) throw new ErroDespesa("Informe o motivo do cancelamento.");

  const despesa = await prisma.despesa.findUnique({ where: { id } });
  if (!despesa) throw new ErroDespesa("Despesa não encontrada.");
  if (despesa.status === "PAGO") {
    throw new ErroDespesa("Não é possível cancelar uma despesa já paga.");
  }
  if (despesa.status === "CANCELADO") {
    throw new ErroDespesa("Esta despesa já está cancelada.");
  }

  return prisma.despesa.update({
    where: { id },
    data: {
      status: "CANCELADO",
      canceladoPorId: usuarioId,
      canceladoEm: new Date(),
      motivoCancelamento: motivoLimpo,
    },
  });
}

export async function duplicarDespesa(id: string, usuarioId: string) {
  const original = await prisma.despesa.findUnique({ where: { id } });
  if (!original) throw new ErroDespesa("Despesa não encontrada.");

  return prisma.despesa.create({
    data: {
      descricao: original.descricao,
      categoriaId: original.categoriaId,
      fornecedorId: original.fornecedorId,
      valor: original.valor,
      dataDespesa: new Date(),
      vencimento: null,
      formaPagamento: original.formaPagamento,
      classificacao: original.classificacao,
      entraNoLucroLiquido: original.entraNoLucroLiquido,
      observacoes: original.observacoes,
      usuarioId,
    },
  });
}

export async function alterarAtivoDespesa(id: string, ativo: boolean) {
  return prisma.despesa.update({ where: { id }, data: { ativo } });
}

export async function anexarComprovante(id: string, comprovantePath: string) {
  return prisma.despesa.update({ where: { id }, data: { comprovantePath } });
}

export async function pausarRecorrencia(id: string) {
  return prisma.despesa.update({ where: { id, despesaOrigemId: null }, data: { statusRecorrencia: "PAUSADA" } });
}

export async function retomarRecorrencia(id: string) {
  return prisma.despesa.update({ where: { id, despesaOrigemId: null }, data: { statusRecorrencia: "ATIVA" } });
}

export async function encerrarRecorrencia(id: string) {
  return prisma.despesa.update({ where: { id, despesaOrigemId: null }, data: { statusRecorrencia: "ENCERRADA" } });
}

export async function buscarDespesaPorId(id: string) {
  return prisma.despesa.findUnique({
    where: { id },
    include: { categoria: true, fornecedor: true, usuario: true, canceladoPor: true, despesaOrigem: true },
  });
}

export type FiltrosDespesas = {
  dataInicio?: Date;
  dataFim?: Date;
  categoriaId?: string;
  status?: StatusEfetivo;
  formaPagamento?: FormaPagamentoDespesa;
  recorrencia?: TipoRecorrencia;
  usuarioId?: string;
  valorMinimo?: number;
  valorMaximo?: number;
  busca?: string;
  apenasArquivadas?: boolean;
  pagina?: number;
  porPagina?: number;
};

export async function listarDespesas(filtros: FiltrosDespesas = {}) {
  await gerarOcorrenciasPendentes();

  const pagina = Math.max(1, filtros.pagina ?? 1);
  const porPagina = filtros.porPagina ?? 20;
  const hoje = new Date();
  const buscaLimpa = filtros.busca?.trim();

  let statusWhere: Prisma.DespesaWhereInput = {};
  if (filtros.status === "vencido") statusWhere = { status: "PENDENTE", vencimento: { lt: hoje } };
  else if (filtros.status === "pendente") {
    statusWhere = { status: "PENDENTE", OR: [{ vencimento: null }, { vencimento: { gte: hoje } }] };
  } else if (filtros.status === "pago") statusWhere = { status: "PAGO" };
  else if (filtros.status === "cancelado") statusWhere = { status: "CANCELADO" };

  const where: Prisma.DespesaWhereInput = {
    ativo: !filtros.apenasArquivadas,
    ...statusWhere,
    ...(filtros.dataInicio || filtros.dataFim
      ? { dataDespesa: { gte: filtros.dataInicio, lte: filtros.dataFim } }
      : {}),
    ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
    ...(filtros.formaPagamento ? { formaPagamento: filtros.formaPagamento } : {}),
    ...(filtros.recorrencia ? { recorrencia: filtros.recorrencia } : {}),
    ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
    ...(filtros.valorMinimo !== undefined || filtros.valorMaximo !== undefined
      ? { valor: { gte: filtros.valorMinimo, lte: filtros.valorMaximo } }
      : {}),
    ...(buscaLimpa ? { descricao: { contains: buscaLimpa, mode: "insensitive" } } : {}),
  };

  const [despesas, total] = await Promise.all([
    prisma.despesa.findMany({
      where,
      include: { categoria: true, fornecedor: true, usuario: true },
      orderBy: { dataDespesa: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.despesa.count({ where }),
  ]);

  return { despesas, total, pagina, porPagina, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) };
}

export async function listarCategoriasDespesa(apenasArquivadas = false) {
  return prisma.categoriaDespesa.findMany({
    where: { ativo: !apenasArquivadas },
    orderBy: { nome: "asc" },
  });
}

export async function criarCategoriaDespesa(nome: string) {
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) throw new ErroDespesa("Informe o nome da categoria.");
  return prisma.categoriaDespesa.create({ data: { nome: nomeLimpo } });
}

export async function alterarAtivoCategoriaDespesa(id: string, ativo: boolean) {
  return prisma.categoriaDespesa.update({ where: { id }, data: { ativo } });
}
