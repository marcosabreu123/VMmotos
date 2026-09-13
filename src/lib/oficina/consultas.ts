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
  const [aPagar, pendente] = await Promise.all([
    prisma.repasseMaoDeObra.aggregate({
      where: { status: "A_PAGAR" },
      _sum: { valor: true },
    }),
    prisma.repasseMaoDeObra.aggregate({
      where: { status: "PENDENTE" },
      _sum: { valor: true },
    }),
  ]);

  return {
    aPagarCentavos: aPagar._sum.valor ?? 0,
    pendenteCentavos: pendente._sum.valor ?? 0,
  };
}
