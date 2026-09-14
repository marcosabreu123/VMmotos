import { prisma } from "../db";

/**
 * Quanto de mão de obra está com o pessoal da oficina, separado por situação.
 *
 * Os dois números respondem perguntas diferentes e não devem ser somados na
 * cabeça do dono:
 *   - `aPagarCentavos`: o cliente já pagou, então esse dinheiro é devido e
 *     entra no próximo fechamento semanal.
 *   - `pendenteCentavos`: o serviço foi feito mas o cliente ainda não quitou.
 *     Ainda não é dívida com o mecânico — vira, quando o cliente pagar.
 *
 * Nenhum dos dois é lucro da loja: o resultado do dono vem das peças.
 */
export async function resumoRepasses() {
  // Um groupBy no lugar de dois aggregate: os dois status saem da mesma
  // varredura, numa ida só ao banco. Isto roda na tela inicial, que é a que
  // mais se abre no dia.
  const linhas = await prisma.repasseMaoDeObra.groupBy({
    by: ["status"],
    where: { status: { in: ["A_PAGAR", "PENDENTE"] } },
    _sum: { valor: true },
  });

  const de = (status: string) => linhas.find((l) => l.status === status)?._sum.valor ?? 0;

  return {
    aPagarCentavos: de("A_PAGAR"),
    pendenteCentavos: de("PENDENTE"),
  };
}
