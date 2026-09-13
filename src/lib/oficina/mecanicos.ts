import { prisma } from "../db";

/**
 * Cadastro dos mecânicos.
 *
 * "Sócio da oficina" é o papel do Verniz: ele entra em 50% de toda mão de
 * obra executada por outro e fica com 100% do que executa sozinho. A regra
 * de divisão em si mora em lib/oficina/repasse.ts — aqui é só o cadastro.
 */

export class ErroMecanico extends Error {}

export async function listarMecanicos(incluirInativos = false) {
  return prisma.mecanico.findMany({
    where: incluirInativos ? undefined : { ativo: true },
    orderBy: [{ socioOficina: "desc" }, { nome: "asc" }],
  });
}

/**
 * O sócio da oficina, se houver.
 *
 * Devolve o mais antigo quando houver mais de um marcado. O cadastro não
 * impede dois sócios de propósito — travar isso atrapalharia uma troca de
 * mão ("marca o novo, depois desmarca o antigo") —, mas a divisão precisa
 * de uma resposta única e determinística.
 */
export async function socioDaOficina() {
  return prisma.mecanico.findFirst({
    where: { socioOficina: true, ativo: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function criarMecanico(dados: { nome: string; socioOficina: boolean }) {
  const nome = dados.nome.trim();
  if (!nome) throw new ErroMecanico("Informe o nome do mecânico.");

  const jaExiste = await prisma.mecanico.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" }, ativo: true },
  });
  if (jaExiste) throw new ErroMecanico(`Já existe um mecânico chamado ${nome}.`);

  return prisma.mecanico.create({
    data: { nome, socioOficina: dados.socioOficina },
  });
}

export async function alterarAtivoMecanico(id: string, ativo: boolean) {
  return prisma.mecanico.update({ where: { id }, data: { ativo } });
}

export async function definirSocio(id: string, socioOficina: boolean) {
  return prisma.mecanico.update({ where: { id }, data: { socioOficina } });
}

/**
 * Quanto cada mecânico tem para receber, separado por situação.
 *
 * PENDENTE (cliente ainda não pagou) e A_PAGAR (já pode entrar no fechamento)
 * vêm separados de propósito: somar os dois faria o dono achar que deve mais
 * do que deve hoje.
 */
export async function totaisPorMecanico() {
  const mecanicos = await listarMecanicos();

  const agrupado = await prisma.repasseMaoDeObra.groupBy({
    by: ["mecanicoId", "status"],
    where: { status: { in: ["PENDENTE", "A_PAGAR"] } },
    _sum: { valor: true },
  });

  return mecanicos.map((mecanico) => {
    const linhas = agrupado.filter((l) => l.mecanicoId === mecanico.id);
    const somaDe = (status: string) =>
      linhas.find((l) => l.status === status)?._sum.valor ?? 0;

    return {
      mecanico,
      pendenteCentavos: somaDe("PENDENTE"),
      aPagarCentavos: somaDe("A_PAGAR"),
    };
  });
}
