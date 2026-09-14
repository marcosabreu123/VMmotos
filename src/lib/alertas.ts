import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { podeLer } from "./permissoes";
import { centavosParaReais } from "./money";
import type { SessaoUsuario } from "./types";

/**
 * Alertas do sininho do topo.
 *
 * São só os cinco que o dono escolheu, e por um motivo: alerta que aparece
 * todo dia vira paisagem e deixa de ser lido. Cada um aqui custa dinheiro se
 * passar batido.
 *
 * DESEMPENHO — por que é uma consulta só, em SQL:
 * Isto roda em TODA tela do sistema. A primeira versão fazia três consultas e
 * trazia todas as peças com todos os lotes para contar em memória. Com o
 * cadastro vazio custava ~240ms; com dois mil itens seria muito pior, e a
 * conta é sempre a mesma: contar. Contar é trabalho de banco.
 *
 * Cada ida ao banco custa uma volta de rede (~200ms daqui), então trocar três
 * idas por uma vale mais que qualquer ganho de índice.
 *
 * Regras da lista:
 *   - "urgente" (vermelho) é o que já está doendo: peça zerada, conta vencida,
 *     conta vencendo. "atencao" (amarelo) é o que vai doer se ninguém olhar.
 *   - Nenhum alerta aparece para quem não pode ver aquela tela: o vendedor não
 *     vê contas a pagar, e isso é checado aqui, não na interface.
 *   - Nada de alerta com contagem zero. A lista vazia é o estado bom.
 */

export type Severidade = "urgente" | "atencao";

export type Alerta = {
  chave: string;
  severidade: Severidade;
  texto: string;
  href: string;
};

/** Dias sem pagar a partir dos quais o débito do cliente vira alerta. */
const DIAS_DEBITO_ANTIGO = 30;

type Contagens = {
  pecas_zeradas: bigint;
  pecas_no_minimo: bigint;
  contas_vencidas: bigint;
  contas_vencendo: bigint;
  clientes_devendo: bigint;
  total_devido: bigint;
};

function inicioDoDia(data = new Date()): Date {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  return d;
}

function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}

export async function listarAlertas(usuario: SessaoUsuario): Promise<Alerta[]> {
  const veEstoque = podeLer(usuario, "estoque");
  const veDespesas = podeLer(usuario, "despesas");
  const veClientes = podeLer(usuario, "clientes");

  if (!veEstoque && !veDespesas && !veClientes) return [];

  const hoje = inicioDoDia();
  const depoisDeAmanha = new Date(hoje);
  depoisDeAmanha.setDate(depoisDeAmanha.getDate() + 2); // cobre hoje e amanhã

  const limiteDebito = new Date(hoje);
  limiteDebito.setDate(limiteDebito.getDate() - DIAS_DEBITO_ANTIGO);

  /*
   * Uma consulta, três subconsultas independentes. Os blocos de quem não tem
   * permissão devolvem zero sem varrer tabela — a permissão continua sendo
   * aplicada no servidor, não escondida na interface.
   *
   * "Zerada" e "no mínimo" são excludentes de propósito: contar a mesma peça
   * nos dois lugares faria o dono achar que são duas.
   */
  const [contagens] = await prisma.$queryRaw<Contagens[]>(Prisma.sql`
    SELECT
      COALESCE(e.zeradas, 0)        AS pecas_zeradas,
      COALESCE(e.no_minimo, 0)      AS pecas_no_minimo,
      COALESCE(d.vencidas, 0)       AS contas_vencidas,
      COALESCE(d.vencendo, 0)       AS contas_vencendo,
      COALESCE(c.clientes, 0)       AS clientes_devendo,
      COALESCE(c.total, 0)          AS total_devido
    FROM
      (SELECT
         COUNT(*) FILTER (WHERE estoque <= 0) AS zeradas,
         COUNT(*) FILTER (WHERE estoque > 0 AND "estoqueMinimo" > 0 AND estoque <= "estoqueMinimo") AS no_minimo
       FROM (
         SELECT p.id, p."estoqueMinimo", COALESCE(SUM(l."quantidadeAtualVenda"), 0) AS estoque
         FROM "Produto" p
         LEFT JOIN "Lote" l ON l."produtoId" = p.id
         WHERE p.ativo = true AND ${veEstoque}
         GROUP BY p.id, p."estoqueMinimo"
       ) por_peca
      ) e
      CROSS JOIN
      (SELECT
         COUNT(*) FILTER (WHERE vencimento < ${hoje}) AS vencidas,
         COUNT(*) FILTER (WHERE vencimento >= ${hoje} AND vencimento < ${depoisDeAmanha}) AS vencendo
       FROM "Despesa"
       WHERE ativo = true AND status = 'PENDENTE' AND vencimento IS NOT NULL AND ${veDespesas}
      ) d
      CROSS JOIN
      (SELECT COUNT(*) AS clientes, COALESCE(SUM(saldo), 0) AS total
       FROM (
         SELECT v."clienteId", SUM(v.total - v."valorPago") AS saldo
         FROM "Venda" v
         WHERE v.status <> 'CANCELADA'
           AND v."clienteId" IS NOT NULL
           AND v."dataHora" < ${limiteDebito}
           AND ${veClientes}
         GROUP BY v."clienteId"
         HAVING SUM(v.total - v."valorPago") > 0
       ) por_cliente
      ) c
  `);

  const alertas: Alerta[] = [];
  const n = (v: bigint | number) => Number(v);

  // ---- 1 e 2: estoque ----
  const zeradas = n(contagens.pecas_zeradas);
  if (zeradas > 0) {
    alertas.push({
      chave: "estoque-zerado",
      severidade: "urgente",
      texto: `${zeradas} ${plural(zeradas, "peça zerada", "peças zeradas")} no estoque`,
      href: "/produtos?filtro=sem-estoque",
    });
  }

  const noMinimo = n(contagens.pecas_no_minimo);
  if (noMinimo > 0) {
    alertas.push({
      chave: "estoque-minimo",
      severidade: "atencao",
      texto: `${noMinimo} ${plural(noMinimo, "peça chegando", "peças chegando")} no mínimo`,
      href: "/produtos?filtro=estoque-baixo",
    });
  }

  // ---- 6 e 7: contas ----
  const vencidas = n(contagens.contas_vencidas);
  if (vencidas > 0) {
    alertas.push({
      chave: "conta-vencida",
      severidade: "urgente",
      texto: `${vencidas} ${plural(vencidas, "conta vencida", "contas vencidas")}`,
      href: "/despesas",
    });
  }

  const vencendo = n(contagens.contas_vencendo);
  if (vencendo > 0) {
    alertas.push({
      chave: "conta-vencendo",
      severidade: "urgente",
      texto: `${vencendo} ${plural(vencendo, "conta vence", "contas vencem")} hoje ou amanhã`,
      href: "/despesas",
    });
  }

  // ---- 5: cliente devendo há mais de 30 dias ----
  const devendo = n(contagens.clientes_devendo);
  if (devendo > 0) {
    alertas.push({
      chave: "debito-antigo",
      severidade: "atencao",
      texto: `${devendo} ${plural(devendo, "cliente deve", "clientes devem")} há mais de ${DIAS_DEBITO_ANTIGO} dias (${centavosParaReais(n(contagens.total_devido))})`,
      href: "/clientes/debitos",
    });
  }

  // Urgente primeiro: o sininho mostra os mais caros de ignorar no topo.
  return alertas.sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "urgente" ? -1 : 1));
}
