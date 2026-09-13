import { prisma } from "./db";

export class ErroInsumo extends Error {}

export type DadosInsumo = {
  nome: string;
  unidade: string;
  custoUnitario: number; // centavos
  estoqueAtual?: number | null;
};

export async function listarInsumos(apenasArquivados = false) {
  return prisma.insumo.findMany({ where: { ativo: !apenasArquivados }, orderBy: { nome: "asc" } });
}

export async function criarInsumo(dados: DadosInsumo) {
  if (!dados.nome.trim()) throw new ErroInsumo("Informe o nome do insumo.");
  if (dados.custoUnitario < 0) throw new ErroInsumo("O custo não pode ser negativo.");
  return prisma.insumo.create({ data: dados });
}

export async function atualizarInsumo(id: string, dados: DadosInsumo) {
  if (!dados.nome.trim()) throw new ErroInsumo("Informe o nome do insumo.");
  if (dados.custoUnitario < 0) throw new ErroInsumo("O custo não pode ser negativo.");
  return prisma.insumo.update({ where: { id }, data: dados });
}

export async function alterarAtivoInsumo(id: string, ativo: boolean) {
  return prisma.insumo.update({ where: { id }, data: { ativo } });
}

export type ItemInsumoUso = { insumoId: string; quantidade: number };

// Uso de insumo é sempre uma ação pós-venda (botão "Registrar insumo usado" na página
// de detalhe), nunca parte da transação de criação da venda — mantém o fluxo de PDV
// intocado. custoRealSnapshot congela o custo do insumo no momento do registro, mesmo
// padrão de ItemVenda.custoRealSnapshot.
export async function registrarUsoInsumos(vendaId: string, itens: ItemInsumoUso[]) {
  if (itens.length === 0) throw new ErroInsumo("Selecione ao menos um insumo.");

  return prisma.$transaction(async (tx) => {
    const criados = [];
    for (const item of itens) {
      if (item.quantidade <= 0) throw new ErroInsumo("Quantidade inválida.");

      const insumo = await tx.insumo.findUnique({ where: { id: item.insumoId } });
      if (!insumo || !insumo.ativo) throw new ErroInsumo("Insumo não encontrado ou inativo.");

      if (insumo.estoqueAtual !== null) {
        if (insumo.estoqueAtual < item.quantidade) {
          throw new ErroInsumo(`Estoque insuficiente de "${insumo.nome}".`);
        }
        await tx.insumo.update({ where: { id: insumo.id }, data: { estoqueAtual: { decrement: item.quantidade } } });
      }

      const criado = await tx.itemVendaInsumo.create({
        data: {
          vendaId,
          insumoId: insumo.id,
          quantidade: item.quantidade,
          custoRealSnapshot: insumo.custoUnitario,
        },
      });
      criados.push(criado);
    }
    return criados;
  });
}

export async function listarUsosPorVenda(vendaId: string) {
  return prisma.itemVendaInsumo.findMany({ where: { vendaId }, include: { insumo: true } });
}

export async function custoTotalInsumosVenda(vendaId: string): Promise<number> {
  const resultado = await prisma.itemVendaInsumo.findMany({ where: { vendaId }, select: { quantidade: true, custoRealSnapshot: true } });
  return resultado.reduce((soma, item) => soma + item.quantidade * item.custoRealSnapshot, 0);
}
