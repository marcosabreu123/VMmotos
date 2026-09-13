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
 * Só pode haver um: definirSocio() desmarca os demais ao marcar alguém. O
 * `orderBy` é rede de segurança para dados antigos ou gravados fora do
 * sistema — a divisão do dinheiro precisa de uma resposta única e sempre
 * igual, nunca de "qualquer um dos marcados".
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

  const criado = await prisma.mecanico.create({
    data: { nome, socioOficina: false },
  });

  // Cadastrar já marcando como sócio passa pela mesma regra de exclusividade
  // do botão da tela: quem entra como sócio desmarca o anterior.
  if (dados.socioOficina) return definirSocio(criado.id, true);

  return criado;
}

export async function renomearMecanico(id: string, nome: string) {
  const limpo = nome.trim();
  if (!limpo) throw new ErroMecanico("Informe o nome do mecânico.");

  const outro = await prisma.mecanico.findFirst({
    where: { nome: { equals: limpo, mode: "insensitive" }, ativo: true, NOT: { id } },
  });
  if (outro) throw new ErroMecanico(`Já existe um mecânico chamado ${limpo}.`);

  return prisma.mecanico.update({ where: { id }, data: { nome: limpo } });
}

export async function alterarAtivoMecanico(id: string, ativo: boolean) {
  return prisma.mecanico.update({ where: { id }, data: { ativo } });
}

/**
 * Define (ou tira) o sócio da oficina.
 *
 * Marcar alguém DESMARCA todos os outros, numa transação: sócio é um papel
 * só. Antes isso não acontecia e dava para ficar com dois marcados — a
 * divisão então usava o mais antigo em silêncio, e o dono veria o dinheiro
 * indo para quem ele achava que tinha acabado de substituir.
 */
export async function definirSocio(id: string, socioOficina: boolean) {
  if (!socioOficina) {
    return prisma.mecanico.update({ where: { id }, data: { socioOficina: false } });
  }

  const [, atualizado] = await prisma.$transaction([
    prisma.mecanico.updateMany({
      where: { socioOficina: true, NOT: { id } },
      data: { socioOficina: false },
    }),
    prisma.mecanico.update({ where: { id }, data: { socioOficina: true } }),
  ]);

  return atualizado;
}

/**
 * Quantos repasses o mecânico já tem — ou seja, se ele tem histórico de
 * dinheiro no sistema.
 */
export async function totalRepassesDoMecanico(id: string): Promise<number> {
  return prisma.repasseMaoDeObra.count({ where: { mecanicoId: id } });
}

/**
 * Exclui o mecânico de vez.
 *
 * Só funciona enquanto ele nunca entrou em nenhum repasse. Quem já recebeu
 * (ou tem valor a receber) NÃO pode ser apagado: isso arrancaria o nome de
 * serviços já lançados e o dono perderia a resposta para "quem fez esse
 * serviço e quanto ele levou". Nesse caso a saída é arquivar — some da
 * operação, o histórico fica em pé.
 */
export async function excluirMecanico(id: string) {
  const mecanico = await prisma.mecanico.findUnique({ where: { id } });
  if (!mecanico) throw new ErroMecanico("Mecânico não encontrado.");

  const repasses = await totalRepassesDoMecanico(id);
  if (repasses > 0) {
    throw new ErroMecanico(
      `${mecanico.nome} já tem mão de obra lançada e não pode ser excluído — o histórico dos serviços dele se perderia. Use "Arquivar": ele some da lista sem apagar o passado.`
    );
  }

  await prisma.mecanico.delete({ where: { id } });
  return mecanico;
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
