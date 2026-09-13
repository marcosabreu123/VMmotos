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

  const hoje = inicioDoDia();
  const depoisDeAmanha = new Date(hoje);
  depoisDeAmanha.setDate(depoisDeAmanha.getDate() + 2); // cobre hoje e amanhã

  const limiteDebito = new Date(hoje);
  limiteDebito.setDate(limiteDebito.getDate() - DIAS_DEBITO_ANTIGO);

  const [produtos, despesasAbertas, vendasEmAberto] = await Promise.all([
    veEstoque
      ? prisma.produto.findMany({
          where: { ativo: true },
          select: { id: true, estoqueMinimo: true, lotes: { select: { quantidadeAtualVenda: true } } },
        })
      : Promise.resolve([]),

    veDespesas
      ? prisma.despesa.findMany({
          where: { ativo: true, status: "PENDENTE", vencimento: { not: null } },
          select: { id: true, vencimento: true },
        })
      : Promise.resolve([]),

    veClientes
      ? prisma.venda.findMany({
          where: { status: { not: "CANCELADA" }, clienteId: { not: null }, dataHora: { lt: limiteDebito } },
          select: { clienteId: true, total: true, valorPago: true },
        })
      : Promise.resolve([]),
  ]);

  const alertas: Alerta[] = [];

  // ---- 1 e 2: estoque ----
  if (veEstoque) {
    let zeradas = 0;
    let noMinimo = 0;

    for (const p of produtos) {
      const estoque = p.lotes.reduce((soma, l) => soma + l.quantidadeAtualVenda, 0);
      if (estoque <= 0) {
        zeradas++;
      } else if (p.estoqueMinimo > 0 && estoque <= p.estoqueMinimo) {
        // Zerada e "no mínimo" são excludentes de propósito: contar a mesma
        // peça nos dois lugares faria o dono achar que são duas.
        noMinimo++;
      }
    }

    if (zeradas > 0) {
      alertas.push({
        chave: "estoque-zerado",
        severidade: "urgente",
        texto: `${zeradas} ${plural(zeradas, "peça zerada", "peças zeradas")} no estoque`,
        href: "/produtos?filtro=sem-estoque",
      });
    }
    if (noMinimo > 0) {
      alertas.push({
        chave: "estoque-minimo",
        severidade: "atencao",
        texto: `${noMinimo} ${plural(noMinimo, "peça chegando", "peças chegando")} no mínimo`,
        href: "/produtos?filtro=estoque-baixo",
      });
    }
  }

  // ---- 6 e 7: contas ----
  if (veDespesas) {
    let vencidas = 0;
    let vencendo = 0;

    for (const d of despesasAbertas) {
      if (!d.vencimento) continue;
      if (d.vencimento < hoje) vencidas++;
      else if (d.vencimento < depoisDeAmanha) vencendo++;
    }

    if (vencidas > 0) {
      alertas.push({
        chave: "conta-vencida",
        severidade: "urgente",
        texto: `${vencidas} ${plural(vencidas, "conta vencida", "contas vencidas")}`,
        href: "/despesas",
      });
    }
    if (vencendo > 0) {
      alertas.push({
        chave: "conta-vencendo",
        severidade: "urgente",
        texto: `${vencendo} ${plural(vencendo, "conta vence", "contas vencem")} hoje ou amanhã`,
        href: "/despesas",
      });
    }
  }

  // ---- 5: cliente devendo há mais de 30 dias ----
  if (veClientes) {
    const porCliente = new Map<string, number>();
    for (const v of vendasEmAberto) {
      const saldo = v.total - v.valorPago;
      if (saldo <= 0 || !v.clienteId) continue;
      porCliente.set(v.clienteId, (porCliente.get(v.clienteId) ?? 0) + saldo);
    }

    if (porCliente.size > 0) {
      const total = [...porCliente.values()].reduce((a, b) => a + b, 0);
      const quantos = porCliente.size;
      alertas.push({
        chave: "debito-antigo",
        severidade: "atencao",
        texto: `${quantos} ${plural(quantos, "cliente deve", "clientes devem")} há mais de ${DIAS_DEBITO_ANTIGO} dias (${centavosParaReais(total)})`,
        href: "/clientes/debitos",
      });
    }
  }

  // Urgente primeiro: o sininho mostra os mais caros de ignorar no topo.
  return alertas.sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "urgente" ? -1 : 1));
}
