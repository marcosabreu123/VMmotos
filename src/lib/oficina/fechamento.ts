import { prisma } from "../db";

/**
 * Fechamento da mão de obra — o momento em que o dono paga o pessoal da
 * oficina e o sistema registra isso.
 *
 * O dono fecha semanalmente, mas o período NÃO é um calendário rígido: fecha-se
 * tudo que está "a pagar" naquele momento. Se ele pular uma semana, ou se um
 * cliente antigo quitar hoje uma venda do mês passado, aquele valor entra no
 * próximo fechamento em vez de ficar órfão numa semana que já passou.
 *
 * Fechar faz três coisas de uma vez, na mesma transação:
 *   1. marca os repasses como PAGO;
 *   2. grava o fechamento (quanto, para quem, de quando até quando);
 *   3. lança a DESPESA correspondente.
 *
 * O passo 3 é o que mantém o lucro honesto. A mão de obra entra como receita
 * na venda, mas não é dinheiro do dono — é de passagem. Sem a despesa, o
 * relatório mostraria como lucro dele um valor que ele repassou.
 */

export class ErroFechamento extends Error {}

const CATEGORIA_COMISSOES = "Comissões";

export type ResumoMecanico = {
  mecanico: { id: string; nome: string; socioOficina: boolean };
  /** centavos — cliente já pagou, entra no fechamento */
  aPagarCentavos: number;
  /** centavos — serviço feito, cliente ainda não quitou */
  pendenteCentavos: number;
  /** Quantos serviços compõem o "a pagar". */
  quantidadeServicos: number;
};

/** O que cada mecânico tem a receber agora. */
export async function resumoParaFechar(): Promise<ResumoMecanico[]> {
  const mecanicos = await prisma.mecanico.findMany({
    where: { ativo: true },
    orderBy: [{ socioOficina: "desc" }, { nome: "asc" }],
  });

  const agrupado = await prisma.repasseMaoDeObra.groupBy({
    by: ["mecanicoId", "status"],
    where: { status: { in: ["PENDENTE", "A_PAGAR"] } },
    _sum: { valor: true },
    _count: true,
  });

  return mecanicos.map((mecanico) => {
    const linhas = agrupado.filter((l) => l.mecanicoId === mecanico.id);
    const de = (status: string) => linhas.find((l) => l.status === status);

    return {
      mecanico: { id: mecanico.id, nome: mecanico.nome, socioOficina: mecanico.socioOficina },
      aPagarCentavos: de("A_PAGAR")?._sum.valor ?? 0,
      pendenteCentavos: de("PENDENTE")?._sum.valor ?? 0,
      quantidadeServicos: de("A_PAGAR")?._count ?? 0,
    };
  });
}

/** Os serviços que compõem o "a pagar" de um mecânico — o extrato dele. */
export async function detalheAPagar(mecanicoId: string) {
  return prisma.repasseMaoDeObra.findMany({
    where: { mecanicoId, status: "A_PAGAR" },
    orderBy: { createdAt: "asc" },
    include: {
      itemVendaServico: {
        include: { venda: { include: { cliente: true, moto: true } } },
      },
    },
  });
}

/**
 * Fecha e paga o que um mecânico tem a receber.
 *
 * Devolve o fechamento criado. Se não houver nada a pagar, recusa em vez de
 * gravar um fechamento de R$ 0,00 — isso só sujaria o histórico e a lista de
 * despesas.
 */
export async function fecharMecanico(params: { mecanicoId: string; usuarioId: string }) {
  const { mecanicoId, usuarioId } = params;

  const mecanico = await prisma.mecanico.findUnique({ where: { id: mecanicoId } });
  if (!mecanico) throw new ErroFechamento("Mecânico não encontrado.");

  const aPagar = await prisma.repasseMaoDeObra.findMany({
    where: { mecanicoId, status: "A_PAGAR" },
    orderBy: { createdAt: "asc" },
    select: { id: true, valor: true, createdAt: true },
  });

  if (aPagar.length === 0) {
    throw new ErroFechamento(`${mecanico.nome} não tem nada a receber no momento.`);
  }

  const total = aPagar.reduce((soma, r) => soma + r.valor, 0);
  const inicio = aPagar[0].createdAt;
  const fim = new Date();

  // A categoria vem do seed; se alguém a apagou, é criada em vez de derrubar
  // o pagamento — o dono está no meio de acertar com o mecânico.
  const categoria =
    (await prisma.categoriaDespesa.findFirst({ where: { nome: CATEGORIA_COMISSOES } })) ??
    (await prisma.categoriaDespesa.create({ data: { nome: CATEGORIA_COMISSOES } }));

  return prisma.$transaction(async (tx) => {
    const despesa = await tx.despesa.create({
      data: {
        descricao: `Mão de obra — ${mecanico.nome}`,
        categoriaId: categoria.id,
        valor: total,
        dataDespesa: fim,
        dataPagamento: fim,
        status: "PAGO",
        classificacao: "OPERACIONAL",
        entraNoLucroLiquido: true,
        usuarioId,
        observacoes: `Fechamento de ${aPagar.length} serviço(s).`,
      },
    });

    const fechamento = await tx.fechamentoRepasse.create({
      data: { mecanicoId, inicio, fim, total, despesaId: despesa.id, usuarioId },
    });

    // Só os repasses desta apuração, por id: entre a leitura e a transação
    // uma venda nova pode ter virado "a pagar", e ela não foi contada no
    // total nem na despesa — tem que ficar para o próximo fechamento.
    await tx.repasseMaoDeObra.updateMany({
      where: { id: { in: aPagar.map((r) => r.id) } },
      data: { status: "PAGO", fechamentoId: fechamento.id },
    });

    return { fechamento, mecanico, total, quantidade: aPagar.length };
  });
}

/** Histórico de pagamentos, do mais recente para o mais antigo. */
export async function historicoFechamentos(limite = 50) {
  return prisma.fechamentoRepasse.findMany({
    orderBy: { createdAt: "desc" },
    take: limite,
    include: {
      mecanico: true,
      _count: { select: { repasses: true } },
    },
  });
}
