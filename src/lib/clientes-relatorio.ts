import { prisma } from "./db";
import { nicho, type RegraPerfilCompra } from "@/config/nicho";

const STATUS_VALIDO = ["CONCLUIDA", "DEVOLVIDA_PARCIAL"] as const;

async function configuracaoSegmentacao() {
  const config = await prisma.configuracaoSegmentacaoClientes.findFirst();
  return (
    config ?? {
      diasInativo: 90,
      diasRecuperado: 30,
      valorAltoTicketCentavos: 30000,
      valorVipCentavos: 100000,
      comprasRecorrente: 3,
    }
  );
}

export type IndicadoresClientes = {
  totalCadastrados: number;
  compraramNoPeriodo: number;
  novos: number;
  recorrentes: number;
  inativos: number;
  taxaRecompra: number;
  ticketMedioPorCliente: number;
  frequenciaMediaCompra: number;
  tempoMedioEntreComprasDias: number | null;
  receitaPorClienteCentavos: number;
};

export async function indicadoresClientes(periodo: { inicio: Date; fim: Date }): Promise<IndicadoresClientes> {
  const config = await configuracaoSegmentacao();
  const hoje = new Date();
  const corteInatividade = new Date(hoje.getTime() - config.diasInativo * 24 * 60 * 60 * 1000);

  const [totalCadastrados, vendasPeriodo, clientesTodos] = await Promise.all([
    prisma.cliente.count({ where: { ativo: true } }),
    prisma.venda.findMany({
      where: { dataHora: { gte: periodo.inicio, lte: periodo.fim }, status: { in: [...STATUS_VALIDO] }, clienteId: { not: null } },
      select: { clienteId: true, total: true, dataHora: true },
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      select: {
        id: true,
        createdAt: true,
        vendas: { where: { status: { in: [...STATUS_VALIDO] } }, select: { dataHora: true } },
      },
    }),
  ]);

  const porCliente = new Map<string, { total: number; qtd: number }>();
  for (const venda of vendasPeriodo) {
    if (!venda.clienteId) continue;
    const atual = porCliente.get(venda.clienteId) ?? { total: 0, qtd: 0 };
    atual.total += venda.total;
    atual.qtd += 1;
    porCliente.set(venda.clienteId, atual);
  }

  const compraramNoPeriodo = porCliente.size;
  const faturamentoPeriodo = vendasPeriodo.reduce((soma, v) => soma + v.total, 0);
  const recorrentesNoPeriodo = Array.from(porCliente.values()).filter((c) => c.qtd >= 2).length;

  let novos = 0;
  let inativos = 0;
  const temposEntreCompras: number[] = [];

  for (const cliente of clientesTodos) {
    if (cliente.createdAt >= periodo.inicio && cliente.createdAt <= periodo.fim) novos++;

    const datasOrdenadas = cliente.vendas.map((v) => v.dataHora).sort((a, b) => a.getTime() - b.getTime());
    const ultimaCompra = datasOrdenadas[datasOrdenadas.length - 1];
    if (!ultimaCompra || ultimaCompra < corteInatividade) inativos++;

    for (let i = 1; i < datasOrdenadas.length; i++) {
      temposEntreCompras.push((datasOrdenadas[i].getTime() - datasOrdenadas[i - 1].getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const tempoMedioEntreComprasDias =
    temposEntreCompras.length > 0 ? temposEntreCompras.reduce((s, v) => s + v, 0) / temposEntreCompras.length : null;

  return {
    totalCadastrados,
    compraramNoPeriodo,
    novos,
    recorrentes: recorrentesNoPeriodo,
    inativos,
    taxaRecompra: compraramNoPeriodo > 0 ? (recorrentesNoPeriodo / compraramNoPeriodo) * 100 : 0,
    ticketMedioPorCliente: compraramNoPeriodo > 0 ? Math.round(faturamentoPeriodo / compraramNoPeriodo) : 0,
    frequenciaMediaCompra: compraramNoPeriodo > 0 ? vendasPeriodo.length / compraramNoPeriodo : 0,
    tempoMedioEntreComprasDias,
    receitaPorClienteCentavos: compraramNoPeriodo > 0 ? Math.round(faturamentoPeriodo / compraramNoPeriodo) : 0,
  };
}

export type FiltrosRanking = {
  dataInicio?: Date;
  dataFim?: Date;
  produtoId?: string;
  categoria?: string;
  marca?: string;
  valorMinimoCentavos?: number;
  valorMaximoCentavos?: number;
  numeroComprasMinimo?: number;
  ultimaCompraDias?: number;
  pagina?: number;
  porPagina?: number;
};

export type LinhaRanking = {
  clienteId: string;
  nome: string;
  telefone: string | null;
  totalGastoCentavos: number;
  numeroCompras: number;
  ticketMedioCentavos: number;
  ultimaCompra: Date;
  produtoMaisComprado: string | null;
  categoriaPreferida: string | null;
  marcaPreferida: string | null;
};

// Cálculo feito em memória (não em SQL agregado) — mesma filosofia já usada em
// resumoComprasMes/relatorios.ts: volume de uma única loja não justifica a
// complexidade extra de agregação em SQL puro.
export async function rankingClientes(filtros: FiltrosRanking = {}): Promise<{ linhas: LinhaRanking[]; total: number }> {
  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    select: {
      id: true,
      nome: true,
      telefone: true,
      vendas: {
        where: {
          status: { in: [...STATUS_VALIDO] },
          ...(filtros.dataInicio || filtros.dataFim ? { dataHora: { gte: filtros.dataInicio, lte: filtros.dataFim } } : {}),
        },
        select: {
          total: true,
          dataHora: true,
          itens: { select: { quantidade: true, produtoId: true, produto: { select: { nome: true, categoria: true, marca: true } } } },
        },
      },
    },
  });

  let linhas: LinhaRanking[] = clientes
    .filter((cliente) => cliente.vendas.length > 0)
    .map((cliente) => {
      const totalGastoCentavos = cliente.vendas.reduce((soma, v) => soma + v.total, 0);
      const numeroCompras = cliente.vendas.length;
      const ultimaCompra = cliente.vendas.reduce((max, v) => (v.dataHora > max ? v.dataHora : max), cliente.vendas[0].dataHora);

      const contagemProduto = new Map<string, { nome: string; qtd: number }>();
      const contagemCategoria = new Map<string, number>();
      const contagemMarca = new Map<string, number>();
      for (const venda of cliente.vendas) {
        for (const item of venda.itens) {
          const produto = contagemProduto.get(item.produtoId) ?? { nome: item.produto.nome, qtd: 0 };
          produto.qtd += item.quantidade;
          contagemProduto.set(item.produtoId, produto);
          contagemCategoria.set(item.produto.categoria, (contagemCategoria.get(item.produto.categoria) ?? 0) + item.quantidade);
          contagemMarca.set(item.produto.marca, (contagemMarca.get(item.produto.marca) ?? 0) + item.quantidade);
        }
      }

      const maisFrequente = <T,>(mapa: Map<T, number | { qtd: number }>): T | null => {
        let melhor: T | null = null;
        let melhorQtd = -1;
        for (const [chave, valor] of mapa.entries()) {
          const qtd = typeof valor === "number" ? valor : valor.qtd;
          if (qtd > melhorQtd) {
            melhorQtd = qtd;
            melhor = chave;
          }
        }
        return melhor;
      };

      const produtoTopId = maisFrequente(contagemProduto);

      return {
        clienteId: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        totalGastoCentavos,
        numeroCompras,
        ticketMedioCentavos: Math.round(totalGastoCentavos / numeroCompras),
        ultimaCompra,
        produtoMaisComprado: produtoTopId ? contagemProduto.get(produtoTopId)?.nome ?? null : null,
        categoriaPreferida: maisFrequente(contagemCategoria),
        marcaPreferida: maisFrequente(contagemMarca),
      };
    });

  if (filtros.produtoId) {
    // refeito via segunda passada simples: mantém só clientes que compraram esse produto no período já filtrado acima
    const idsComProduto = new Set(
      clientes
        .filter((c) => c.vendas.some((v) => v.itens.some((i) => i.produtoId === filtros.produtoId)))
        .map((c) => c.id)
    );
    linhas = linhas.filter((linha) => idsComProduto.has(linha.clienteId));
  }
  if (filtros.categoria) linhas = linhas.filter((linha) => linha.categoriaPreferida === filtros.categoria);
  if (filtros.marca) linhas = linhas.filter((linha) => linha.marcaPreferida === filtros.marca);
  if (filtros.valorMinimoCentavos !== undefined) linhas = linhas.filter((linha) => linha.totalGastoCentavos >= filtros.valorMinimoCentavos!);
  if (filtros.valorMaximoCentavos !== undefined) linhas = linhas.filter((linha) => linha.totalGastoCentavos <= filtros.valorMaximoCentavos!);
  if (filtros.numeroComprasMinimo !== undefined) linhas = linhas.filter((linha) => linha.numeroCompras >= filtros.numeroComprasMinimo!);
  if (filtros.ultimaCompraDias !== undefined) {
    const corte = new Date(Date.now() - filtros.ultimaCompraDias * 24 * 60 * 60 * 1000);
    linhas = linhas.filter((linha) => linha.ultimaCompra >= corte);
  }

  linhas.sort((a, b) => b.totalGastoCentavos - a.totalGastoCentavos);

  const total = linhas.length;
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const porPagina = filtros.porPagina ?? 30;
  const linhasPagina = linhas.slice((pagina - 1) * porPagina, pagina * porPagina);

  return { linhas: linhasPagina, total };
}

export type ClienteInativo = {
  clienteId: string;
  nome: string;
  telefone: string | null;
  ultimaCompra: Date | null;
  totalHistoricoCentavos: number;
  produtoMaisComprado: string | null;
  diasSemComprar: number | null;
};

export async function clientesInativos(diasCorte: number): Promise<ClienteInativo[]> {
  const corte = new Date(Date.now() - diasCorte * 24 * 60 * 60 * 1000);
  const hoje = new Date();

  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    select: {
      id: true,
      nome: true,
      telefone: true,
      vendas: {
        where: { status: { in: [...STATUS_VALIDO] } },
        select: { total: true, dataHora: true, itens: { select: { produtoId: true, quantidade: true, produto: { select: { nome: true } } } } },
      },
    },
  });

  const inativos: ClienteInativo[] = [];
  for (const cliente of clientes) {
    const datas = cliente.vendas.map((v) => v.dataHora).sort((a, b) => b.getTime() - a.getTime());
    const ultimaCompra = datas[0] ?? null;

    if (ultimaCompra && ultimaCompra >= corte) continue; // comprou recentemente, não é inativo

    const totalHistoricoCentavos = cliente.vendas.reduce((soma, v) => soma + v.total, 0);
    const contagemProduto = new Map<string, { nome: string; qtd: number }>();
    for (const venda of cliente.vendas) {
      for (const item of venda.itens) {
        const produto = contagemProduto.get(item.produtoId) ?? { nome: item.produto.nome, qtd: 0 };
        produto.qtd += item.quantidade;
        contagemProduto.set(item.produtoId, produto);
      }
    }
    let produtoMaisComprado: string | null = null;
    let melhorQtd = -1;
    for (const produto of contagemProduto.values()) {
      if (produto.qtd > melhorQtd) {
        melhorQtd = produto.qtd;
        produtoMaisComprado = produto.nome;
      }
    }

    inativos.push({
      clienteId: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone,
      ultimaCompra,
      totalHistoricoCentavos,
      produtoMaisComprado,
      diasSemComprar: ultimaCompra ? Math.floor((hoje.getTime() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24)) : null,
    });
  }

  return inativos.sort((a, b) => (b.diasSemComprar ?? Infinity) - (a.diasSemComprar ?? Infinity));
}

export type Segmentos = {
  novos: number;
  recorrentes: number;
  vip: number;
  altoTicket: number;
  inativos: number;
  recuperados: number;
  /** Perfis definidos em src/config/nicho.ts — variam por segmento de negócio. */
  perfisCompra: Array<{ chave: string; rotulo: string; total: number }>;
};

type ProdutoDoItem = {
  atributoA: string | null;
  atributoB: string | null;
  categoria: string;
  medida: number | null;
  tipoVenda: string;
};

/** Aplica uma regra de perfil de compra a um produto vendido. */
function produtoAtendeRegra(produto: ProdutoDoItem, regra: RegraPerfilCompra): boolean {
  const q = regra.quando;
  switch (q.tipo) {
    case "atributoA":
      return produto.atributoA === q.valor;
    case "atributoB":
      return produto.atributoB === q.valor;
    case "categoriaContem":
      return produto.categoria.toLowerCase().includes(q.texto.toLowerCase());
    case "medidaAte":
      return produto.medida !== null && produto.medida <= q.valor;
    case "medidaAcimaDe":
      return produto.medida !== null && produto.medida > q.valor;
    case "vendaFracionada":
      return produto.tipoVenda === "FRACIONADO";
  }
}

export async function segmentosClientes(): Promise<Segmentos> {
  const config = await configuracaoSegmentacao();
  const hoje = new Date();
  const corteInatividade = new Date(hoje.getTime() - config.diasInativo * 24 * 60 * 60 * 1000);
  const corteRecuperado = new Date(hoje.getTime() - config.diasRecuperado * 24 * 60 * 60 * 1000);
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    select: {
      createdAt: true,
      vendas: {
        where: { status: { in: [...STATUS_VALIDO] } },
        select: {
          dataHora: true,
          total: true,
          itens: { select: { produto: { select: { atributoA: true, atributoB: true, tipoVenda: true, categoria: true, medida: true } } } },
        },
      },
    },
  });

  const segmentos: Segmentos = {
    novos: 0,
    recorrentes: 0,
    vip: 0,
    altoTicket: 0,
    inativos: 0,
    recuperados: 0,
    perfisCompra: nicho.perfisDeCompra.map((r) => ({ chave: r.chave, rotulo: r.rotulo, total: 0 })),
  };

  for (const cliente of clientes) {
    const datas = cliente.vendas.map((v) => v.dataHora).sort((a, b) => a.getTime() - b.getTime());
    const totalGasto = cliente.vendas.reduce((soma, v) => soma + v.total, 0);
    const ultimaCompra = datas[datas.length - 1];

    if (cliente.createdAt >= trintaDiasAtras) segmentos.novos++;
    if (cliente.vendas.length >= config.comprasRecorrente) segmentos.recorrentes++;
    if (totalGasto >= config.valorVipCentavos) segmentos.vip++;
    if (totalGasto >= config.valorAltoTicketCentavos) segmentos.altoTicket++;
    if (!ultimaCompra || ultimaCompra < corteInatividade) segmentos.inativos++;

    // Recuperado: teve uma lacuna >= diasInativo entre duas compras consecutivas,
    // e a compra seguinte a essa lacuna aconteceu recentemente (dentro de diasRecuperado).
    for (let i = 1; i < datas.length; i++) {
      const gapDias = (datas[i].getTime() - datas[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      if (gapDias >= config.diasInativo && datas[i] >= corteRecuperado) {
        segmentos.recuperados++;
        break;
      }
    }

    // Um cliente conta uma vez por perfil, mesmo tendo comprado vários itens dele.
    nicho.perfisDeCompra.forEach((regra, indice) => {
      const atende = cliente.vendas.some((venda) =>
        venda.itens.some((item) => produtoAtendeRegra(item.produto, regra))
      );
      if (atende) segmentos.perfisCompra[indice].total++;
    });
  }

  return segmentos;
}

export type IndicadoresCliente = {
  totalGastoCentavos: number;
  numeroCompras: number;
  ticketMedioCentavos: number;
  primeiraCompra: Date | null;
  ultimaCompra: Date | null;
  frequenciaMediaDias: number | null;
  diasDesdeUltimaCompra: number | null;
  produtoFavorito: string | null;
  marcaPreferida: string | null;
  categoriaPreferida: string | null;
};

export async function indicadoresDoCliente(clienteId: string): Promise<IndicadoresCliente> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      vendas: {
        where: { status: { in: [...STATUS_VALIDO] } },
        select: {
          total: true,
          dataHora: true,
          itens: { select: { quantidade: true, produto: { select: { nome: true, categoria: true, marca: true } } } },
        },
      },
    },
  });

  if (!cliente || cliente.vendas.length === 0) {
    return {
      totalGastoCentavos: 0,
      numeroCompras: 0,
      ticketMedioCentavos: 0,
      primeiraCompra: null,
      ultimaCompra: null,
      frequenciaMediaDias: null,
      diasDesdeUltimaCompra: null,
      produtoFavorito: null,
      marcaPreferida: null,
      categoriaPreferida: null,
    };
  }

  const datas = cliente.vendas.map((v) => v.dataHora).sort((a, b) => a.getTime() - b.getTime());
  const totalGastoCentavos = cliente.vendas.reduce((soma, v) => soma + v.total, 0);
  const numeroCompras = cliente.vendas.length;

  const gaps: number[] = [];
  for (let i = 1; i < datas.length; i++) gaps.push((datas[i].getTime() - datas[i - 1].getTime()) / (1000 * 60 * 60 * 24));

  const contagemProduto = new Map<string, number>();
  const contagemCategoria = new Map<string, number>();
  const contagemMarca = new Map<string, number>();
  for (const venda of cliente.vendas) {
    for (const item of venda.itens) {
      contagemProduto.set(item.produto.nome, (contagemProduto.get(item.produto.nome) ?? 0) + item.quantidade);
      contagemCategoria.set(item.produto.categoria, (contagemCategoria.get(item.produto.categoria) ?? 0) + item.quantidade);
      contagemMarca.set(item.produto.marca, (contagemMarca.get(item.produto.marca) ?? 0) + item.quantidade);
    }
  }
  const maisFrequente = (mapa: Map<string, number>): string | null => {
    let melhor: string | null = null;
    let melhorQtd = -1;
    for (const [chave, qtd] of mapa.entries()) {
      if (qtd > melhorQtd) {
        melhorQtd = qtd;
        melhor = chave;
      }
    }
    return melhor;
  };

  const ultimaCompra = datas[datas.length - 1];

  return {
    totalGastoCentavos,
    numeroCompras,
    ticketMedioCentavos: Math.round(totalGastoCentavos / numeroCompras),
    primeiraCompra: datas[0],
    ultimaCompra,
    frequenciaMediaDias: gaps.length > 0 ? gaps.reduce((s, v) => s + v, 0) / gaps.length : null,
    diasDesdeUltimaCompra: Math.floor((Date.now() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24)),
    produtoFavorito: maisFrequente(contagemProduto),
    marcaPreferida: maisFrequente(contagemMarca),
    categoriaPreferida: maisFrequente(contagemCategoria),
  };
}

// Segmentos de UM cliente específico, para exibir no perfil dele.
export async function segmentosDoCliente(clienteId: string): Promise<string[]> {
  const config = await configuracaoSegmentacao();
  const hoje = new Date();
  const corteInatividade = new Date(hoje.getTime() - config.diasInativo * 24 * 60 * 60 * 1000);
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      createdAt: true,
      vendas: {
        where: { status: { in: [...STATUS_VALIDO] } },
        select: { dataHora: true, total: true },
      },
    },
  });
  if (!cliente) return [];

  const datas = cliente.vendas.map((v) => v.dataHora).sort((a, b) => a.getTime() - b.getTime());
  const totalGasto = cliente.vendas.reduce((soma, v) => soma + v.total, 0);
  const ultimaCompra = datas[datas.length - 1];

  const tags: string[] = [];
  if (cliente.createdAt >= trintaDiasAtras) tags.push("Novo");
  if (cliente.vendas.length >= config.comprasRecorrente) tags.push("Recorrente");
  if (totalGasto >= config.valorVipCentavos) tags.push("VIP");
  else if (totalGasto >= config.valorAltoTicketCentavos) tags.push("Alto ticket");
  if (!ultimaCompra || ultimaCompra < corteInatividade) tags.push("Inativo");
  return tags;
}
