import { prisma } from "./db";

/**
 * Edição de preços em massa.
 *
 * A tela mostra custo, venda e lucro de todas as peças de uma vez, para o
 * dono ajustar margem sem abrir peça por peça.
 *
 * Sobre qual custo é editado aqui: `precoCustoRef` é o custo de REFERÊNCIA do
 * cadastro, não o custo real da mercadoria em estoque — esse vem do lote, com
 * o frete rateado, e é o que o relatório de lucro usa. Mexer aqui muda a
 * referência e a margem exibida daqui pra frente; não reescreve venda passada,
 * que guarda seu próprio snapshot de custo.
 */

export class ErroPreco extends Error {}

export type LinhaPreco = {
  id: string;
  nome: string;
  marca: string;
  categoria: string;
  sku: string;
  precoCustoRef: number;
  precoVenda: number;
  /** centavos — precoVenda - precoCustoRef */
  lucroCentavos: number;
  /** Percentual sobre o preço de venda. null quando não dá para calcular. */
  margemPercentual: number | null;
};

/** Margem sobre o preço de venda (não sobre o custo) — é como se olha margem no varejo. */
export function calcularMargem(precoCusto: number, precoVenda: number): number | null {
  if (precoVenda <= 0) return null;
  return ((precoVenda - precoCusto) / precoVenda) * 100;
}

export async function listarPrecos(busca?: string): Promise<LinhaPreco[]> {
  const termo = busca?.trim();

  const produtos = await prisma.produto.findMany({
    where: {
      ativo: true,
      ...(termo
        ? {
            OR: [
              { nome: { contains: termo, mode: "insensitive" } },
              { marca: { contains: termo, mode: "insensitive" } },
              { sku: { contains: termo, mode: "insensitive" } },
              { categoria: { contains: termo, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ categoria: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      marca: true,
      categoria: true,
      sku: true,
      precoCustoRef: true,
      precoVenda: true,
    },
  });

  return produtos.map((p) => ({
    ...p,
    lucroCentavos: p.precoVenda - p.precoCustoRef,
    margemPercentual: calcularMargem(p.precoCustoRef, p.precoVenda),
  }));
}

export type AlteracaoPreco = {
  produtoId: string;
  precoCustoRef: number;
  precoVenda: number;
};

/**
 * Grava várias alterações de uma vez.
 *
 * Tudo numa transação: numa tela em que o dono mexe em dezenas de linhas
 * antes de salvar, gravar metade e falhar no meio deixaria a tabela de preços
 * num estado que ele não escolheu e não teria como desfazer.
 *
 * Devolve as alterações efetivamente aplicadas, com os valores antigos, para
 * a auditoria registrar o que mudou.
 */
export async function salvarPrecosEmMassa(alteracoes: AlteracaoPreco[]) {
  if (alteracoes.length === 0) return [];

  for (const a of alteracoes) {
    if (!Number.isInteger(a.precoCustoRef) || !Number.isInteger(a.precoVenda)) {
      throw new ErroPreco("Preço precisa estar em centavos inteiros.");
    }
    if (a.precoCustoRef < 0 || a.precoVenda < 0) {
      throw new ErroPreco("Preço não pode ser negativo.");
    }
  }

  const ids = alteracoes.map((a) => a.produtoId);
  const atuais = await prisma.produto.findMany({
    where: { id: { in: ids } },
    select: { id: true, nome: true, precoCustoRef: true, precoVenda: true },
  });
  const porId = new Map(atuais.map((p) => [p.id, p]));

  const faltando = ids.filter((id) => !porId.has(id));
  if (faltando.length > 0) {
    throw new ErroPreco("Alguma peça da lista não existe mais. Recarregue a tela.");
  }

  // Só grava o que realmente mudou: evita encher a auditoria de linhas iguais
  // quando o dono salva a tela inteira tendo mexido em três preços.
  const mudaram = alteracoes.filter((a) => {
    const atual = porId.get(a.produtoId)!;
    return atual.precoCustoRef !== a.precoCustoRef || atual.precoVenda !== a.precoVenda;
  });

  if (mudaram.length === 0) return [];

  await prisma.$transaction(
    mudaram.map((a) =>
      prisma.produto.update({
        where: { id: a.produtoId },
        data: { precoCustoRef: a.precoCustoRef, precoVenda: a.precoVenda },
      })
    )
  );

  return mudaram.map((a) => {
    const antes = porId.get(a.produtoId)!;
    return {
      produtoId: a.produtoId,
      nome: antes.nome,
      custoAntes: antes.precoCustoRef,
      custoDepois: a.precoCustoRef,
      vendaAntes: antes.precoVenda,
      vendaDepois: a.precoVenda,
    };
  });
}
