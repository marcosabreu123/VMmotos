/**
 * Tipos e contas puras do gráfico de faturamento.
 *
 * Mora fora de lib/relatorios.ts de propósito: aquele arquivo importa o Prisma
 * no topo, e o gráfico é um componente de cliente. Importar de lá arrastava o
 * Prisma para o navegador e a hidratação morria em silêncio — a tela ficava
 * eternamente no esqueleto de carregamento, sem erro nenhum no console.
 */

export type PeriodoGrafico = "semana" | "mes" | "ano" | "tudo" | "personalizado";

/** Intervalo escolhido à mão, em "YYYY-MM-DD". */
export type IntervaloPersonalizado = { de: string; ate: string };

/** Só os atalhos de janela fixa; "tudo" e "personalizado" não têm tamanho. */
export const DIAS_DO_PERIODO: Record<Exclude<PeriodoGrafico, "tudo" | "personalizado">, number> = {
  semana: 7,
  mes: 30,
  ano: 365,
};

export type PontoFaturamento = {
  /** "2026-09-26" — já no dia da loja, não em UTC. */
  dia: string;
  totalCentavos: number;
  vendas: number;
};

/**
 * Recorta a série por período.
 *
 * Os quatro períodos são recortes da MESMA série: o servidor manda uma vez e a
 * troca de botão é instantânea, sem ida ao banco.
 *
 * O começo nunca é anterior à primeira venda. Uma loja com 11 dias de vida
 * pedindo "ano" renderia 354 dias chapados no zero antes de existir — feio e
 * sem informação nenhuma.
 */
export function recortarPeriodo(
  pontos: PontoFaturamento[],
  periodo: PeriodoGrafico,
  intervalo?: IntervaloPersonalizado
): PontoFaturamento[] {
  if (periodo === "personalizado") {
    if (!intervalo?.de || !intervalo?.ate) return [];
    // Datas invertidas não são erro do dono: ele digita na ordem que quiser e
    // o intervalo se endireita sozinho.
    const [de, ate] = intervalo.de <= intervalo.ate ? [intervalo.de, intervalo.ate] : [intervalo.ate, intervalo.de];
    return pontos.filter((p) => p.dia >= de && p.dia <= ate);
  }

  if (periodo === "tudo") return pontos;
  return pontos.slice(-DIAS_DO_PERIODO[periodo]);
}
