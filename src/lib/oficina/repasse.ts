/**
 * Divisão da mão de obra entre o pessoal da oficina.
 *
 * Aqui não há acesso a banco de propósito: é aritmética de dinheiro, a parte
 * que não pode errar, e assim dá para testar sozinha.
 *
 * REGRA DA VM MOTO PEÇAS (definida com o dono):
 *   - o sócio da oficina (o "Verniz") leva 50% de toda mão de obra, inclusive
 *     quando não encostou no serviço;
 *   - se ele executou sozinho, leva 100%;
 *   - cliente que traz a própria peça não muda nada: o sócio mantém os 50%;
 *   - retorno de garantia não gera repasse nenhum.
 * Nunca há mais de dois beneficiários — o sócio e, quando houver, o executor.
 *
 * O que sai daqui é só o PADRÃO sugerido na tela. O dono pode ajustar os
 * percentuais na hora da venda, então nada neste arquivo pode assumir que a
 * divisão é sempre 50/50.
 */

/** Escala dos percentuais: pontos-base, 10000 = 100,00%. */
export const TOTAL_PONTOS_BASE = 10_000;

export type BeneficiarioRepasse = {
  mecanicoId: string;
  /** Pontos-base: 5000 = 50,00%. */
  percentual: number;
};

export type RepasseCalculado = BeneficiarioRepasse & {
  /** centavos */
  valor: number;
};

export class ErroRepasse extends Error {}

/**
 * Divisão sugerida para um serviço.
 *
 * `socioId` pode vir nulo quando a loja ainda não marcou ninguém como sócio —
 * nesse caso o executor leva tudo, que é o comportamento menos surpreendente
 * (melhor do que travar a venda por causa de um cadastro incompleto).
 */
export function divisaoPadrao(params: {
  executorId: string;
  socioId: string | null;
  /** Retorno de garantia: serviço refeito não paga ninguém de novo. */
  garantia?: boolean;
}): BeneficiarioRepasse[] {
  const { executorId, socioId, garantia = false } = params;

  if (garantia) return [];

  if (!socioId || socioId === executorId) {
    return [{ mecanicoId: executorId, percentual: TOTAL_PONTOS_BASE }];
  }

  // Ordem importa: quem vier por último absorve a sobra de arredondamento
  // (ver dividirMaoDeObra). O sócio fica por último por ser o beneficiário
  // fixo — assim a sobra cai sempre na mesma pessoa, e não ora num ora noutro.
  return [
    { mecanicoId: executorId, percentual: TOTAL_PONTOS_BASE / 2 },
    { mecanicoId: socioId, percentual: TOTAL_PONTOS_BASE / 2 },
  ];
}

/**
 * Reparte `valorCentavos` entre os beneficiários.
 *
 * A soma dos valores devolvidos é EXATAMENTE `valorCentavos`. Cada um recebe
 * o valor truncado do seu percentual e o último absorve a diferença — sem
 * isso, R$ 35,01 dividido meio a meio devolveria R$ 17,50 + R$ 17,50 e um
 * centavo evaporaria a cada serviço ímpar.
 */
export function dividirMaoDeObra(
  valorCentavos: number,
  beneficiarios: BeneficiarioRepasse[]
): RepasseCalculado[] {
  if (!Number.isInteger(valorCentavos)) {
    throw new ErroRepasse("O valor do serviço precisa estar em centavos inteiros.");
  }
  if (valorCentavos < 0) {
    throw new ErroRepasse("O valor do serviço não pode ser negativo.");
  }
  if (beneficiarios.length === 0) return [];

  const soma = beneficiarios.reduce((acc, b) => acc + b.percentual, 0);
  if (soma !== TOTAL_PONTOS_BASE) {
    throw new ErroRepasse(
      `A divisão precisa somar 100%. Somou ${(soma / 100).toFixed(2)}%.`
    );
  }
  if (beneficiarios.some((b) => b.percentual < 0)) {
    throw new ErroRepasse("Percentual negativo na divisão da mão de obra.");
  }

  const idsRepetidos = new Set<string>();
  for (const b of beneficiarios) {
    if (idsRepetidos.has(b.mecanicoId)) {
      throw new ErroRepasse("O mesmo mecânico apareceu duas vezes na divisão.");
    }
    idsRepetidos.add(b.mecanicoId);
  }

  const resultado: RepasseCalculado[] = [];
  let distribuido = 0;

  beneficiarios.forEach((b, indice) => {
    const ultimo = indice === beneficiarios.length - 1;
    const valor = ultimo
      ? valorCentavos - distribuido
      : Math.floor((valorCentavos * b.percentual) / TOTAL_PONTOS_BASE);
    distribuido += valor;
    resultado.push({ ...b, valor });
  });

  return resultado;
}
