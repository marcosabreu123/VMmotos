import type { FormaPagamento, StatusVenda } from "@prisma/client";
import { buscarClientes } from "@/lib/clientes";
import { buscarProdutosParaVenda, buscarProdutoPorId, estoqueTotalProduto } from "@/lib/produtos";
import { listarVisaoEstoque } from "@/lib/estoque";
import { listarVendas, buscarVendaPorId, type FiltrosVendas } from "@/lib/vendas";
import { podeVerVendasCanceladas } from "@/lib/permissoes";
import { listarFornecedores } from "@/lib/fornecedores";
import { listarPedidos, buscarPedidoPorId, type FiltrosPedidos } from "@/lib/compras";
import { listarDespesas, type FiltrosDespesas } from "@/lib/despesas";
import { resumoDashboard } from "@/lib/dashboard";
import { indicadoresLucro, resolverPeriodo, type ChavePeriodo, type Regime } from "@/lib/lucro";
import { rankingClientes, indicadoresDoCliente, type FiltrosRanking } from "@/lib/clientes-relatorio";
import { centavosParaReais } from "@/lib/money";
import { podeVerCustos } from "@/lib/permissoes";
import { limitesDoDia } from "../datas";
import { nicho } from "@/config/nicho";

/** " (Geral, Acessórios...)" — exemplos tirados da config do nicho. */
function exemploCategorias(): string {
  const cats = nicho.categoriasProdutoIniciais.slice(0, 3);
  return cats.length > 0 ? ` (${cats.join(", ")}...)` : "";
}
import type { FerramentaAssistente } from "../types";

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

// Identificação completa do produto. É a CATEGORIA que separa "Yara — Perfume
// 100ml" de "Yara — Body Splash 300ml": dois produtos de mesmo nome, marcas e
// preços diferentes. Sem ela na resposta, quem lê (inclusive o assistente) não
// tem como distinguir um do outro nem entender o vocabulário da loja.
export function descreverProduto(p: {
  nome: string;
  categoria: string;
  medida: number | null;
  marca: string;
}): string {
  const tamanho = p.medida ? ` ${p.medida}ml` : "";
  return `${p.nome} — ${p.categoria}${tamanho} (${p.marca})`;
}

const CHAVES_PERIODO: ChavePeriodo[] = ["hoje", "ontem", "7dias", "mesAtual", "mesAnterior"];

function resolverPeriodoArgs(args: Record<string, unknown>): { inicio: Date; fim: Date } {
  const chave = texto(args.periodo);
  if (chave && (CHAVES_PERIODO as string[]).includes(chave)) {
    return resolverPeriodo(chave as ChavePeriodo);
  }
  const dataInicio = texto(args.dataInicio);
  const dataFim = texto(args.dataFim);
  if (dataInicio && dataFim) {
    return { inicio: limitesDoDia(dataInicio).inicio, fim: limitesDoDia(dataFim).fim };
  }
  // padrão: mês atual, se nada foi informado
  return resolverPeriodo("mesAtual");
}

export const ferramentasConsulta: FerramentaAssistente[] = [
  {
    nome: "search_customers",
    descricao:
      "Busca clientes cadastrados por nome ou telefone (parcial, ignora acentuação). Use antes de qualquer operação envolvendo um cliente para achar o id certo e detectar ambiguidade (mais de um resultado).",
    recurso: "clientes",
    nivel: 1,
    exigeEscrita: false,
    parametros: {
      type: "object",
      properties: {
        termo: { type: "string", description: "Nome ou telefone (mesmo que parcial) do cliente" },
      },
      required: ["termo"],
    },
    handler: async (args) => {
      const termo = texto(args.termo) ?? "";
      const resultados = await buscarClientes(termo);
      return {
        success: true,
        data: resultados,
        message:
          resultados.length === 0
            ? `Nenhum cliente encontrado para "${termo}".`
            : `${resultados.length} cliente(s) encontrado(s).`,
      };
    },
  },
  {
    nome: "search_products",
    descricao:
      `Busca ${nicho.termos.produto.plural.toLowerCase()} ativos por nome, ${nicho.termos.marca.toLowerCase()}, SKU, código de barras ou tamanho. Aceita várias palavras juntas, do jeito que o usuário fala (nome + marca + tamanho na mesma frase), ignora acentuação e tolera erro de digitação. Os resultados vêm ORDENADOS POR RELEVÂNCIA: o primeiro é o que melhor corresponde ao que foi pedido. Cada resultado traz a CATEGORIA${exemploCategorias()}, que é como o negócio separa os tipos de ${nicho.termos.produto.singular.toLowerCase()} — dois itens de mesmo nome só se distinguem por ela e pelo tamanho.`,
    recurso: "produtos",
    nivel: 1,
    exigeEscrita: false,
    parametros: {
      type: "object",
      properties: {
        termo: { type: "string", description: "Nome, marca, SKU ou código de barras (parcial). Para procurar VÁRIOS produtos, use 'termos' em vez de chamar esta ferramenta uma vez por produto." },
        termos: {
          type: "array",
          items: { type: "string" },
          description:
            `Vários ${nicho.termos.produto.plural.toLowerCase()} de uma vez, um por item da lista. SEMPRE use este campo quando precisar procurar mais de um — uma chamada com a lista inteira, nunca uma chamada por ${nicho.termos.produto.singular.toLowerCase()}.`,
        },
        ...(nicho.atributos.atributoB.ativo
          ? {
              atributoB: {
                type: "string",
                description: nicho.atributos.atributoB.rotulo,
                ...(nicho.atributos.atributoB.opcoes.length > 0
                  ? { enum: nicho.atributos.atributoB.opcoes.map((o) => o.valor) }
                  : {}),
              },
            }
          : {}),
      },
    },
    handler: async (args) => {
      const atributoB = texto(args.atributoB) as string | undefined;

      // Busca em lote. Procurar 13 produtos de um pedido com uma chamada por
      // produto levava o turno perto do limite de tempo da função na Vercel, e
      // o usuário via "falha de conexão". Em paralelo, é uma ida só.
      const listaTermos = Array.isArray(args.termos)
        ? (args.termos as unknown[]).map((t) => texto(t)).filter((t): t is string => !!t)
        : [];
      if (listaTermos.length > 0) {
        const grupos = await Promise.all(
          listaTermos.map(async (t) => {
            const achados = await buscarProdutosParaVenda({ termo: t, atributoB });
            return {
              termo: t,
              encontrados: achados.slice(0, 5).map((p, i) => ({
                id: p.id,
                descricao: descreverProduto(p),
                sku: p.sku,
                categoria: p.categoria,
                medida: p.medida,
                precoVenda: centavosParaReais(p.precoVenda),
                estoqueAtual: p.estoqueAtual,
                melhorCorrespondencia: i === 0,
              })),
            };
          })
        );
        const semResultado = grupos.filter((g) => g.encontrados.length === 0).map((g) => g.termo);
        return {
          success: true,
          data: { resultadosPorTermo: grupos },
          message:
            `Busca de ${grupos.length} termo(s). ` +
            (semResultado.length === 0
              ? "Todos encontrados."
              : `Sem cadastro: ${semResultado.join(", ")}.`),
        };
      }

      const termo = texto(args.termo);
      const resultados = await buscarProdutosParaVenda({ termo, atributoB });

      // O primeiro resultado é o mais relevante. Quando o usuário disse marca e
      // nome ("Yara da Lattafa"), o correto costuma ser esse — dizer isso
      // explicitamente evita que o modelo pergunte de novo o que já foi dito.
      const melhor = resultados[0];
      let message: string;
      if (resultados.length === 0) {
        message = `Nenhum produto encontrado para "${termo ?? ""}".`;
      } else if (resultados.length === 1) {
        message = `1 produto encontrado: ${descreverProduto(melhor)}.`;
      } else {
        message =
          `${resultados.length} produtos encontrados, do mais relevante para o menos. ` +
          `Melhor correspondência: ${descreverProduto(melhor)}, ${centavosParaReais(melhor.precoVenda)}, ` +
          `${melhor.estoqueAtual} em estoque.`;
      }

      return {
        success: true,
        data: resultados.map((produto, indice) => ({
          id: produto.id,
          // texto pronto, para o modelo nunca precisar remontar a identificação
          descricao: descreverProduto(produto),
          nome: produto.nome,
          categoria: produto.categoria,
          marca: produto.marca,
          sku: produto.sku,
          medida: produto.medida,
          precoVenda: centavosParaReais(produto.precoVenda),
          atributoB: produto.atributoB,
          estoqueAtual: produto.estoqueAtual,
          melhorCorrespondencia: indice === 0,
        })),
        message,
      };
    },
  },
  {
    nome: "check_product_stock",
    descricao: "Consulta o estoque atual de um produto específico pelo id (use search_products antes para achar o id).",
    recurso: "estoque",
    nivel: 1,
    exigeEscrita: false,
    parametros: {
      type: "object",
      properties: { produtoId: { type: "string" } },
      required: ["produtoId"],
    },
    handler: async (args) => {
      const produtoId = texto(args.produtoId) ?? "";
      const produto = await buscarProdutoPorId(produtoId);
      if (!produto) {
        return { success: false, error_code: "PRODUTO_NAO_ENCONTRADO", message: "Produto não encontrado." };
      }
      if (!produto.ativo) {
        return {
          success: false,
          error_code: "PRODUTO_ARQUIVADO",
          message: `"${produto.nome}" está arquivado (inativo).`,
        };
      }
      const quantidade = await estoqueTotalProduto(produtoId);
      return {
        success: true,
        data: { produto: produto.nome, quantidadeAtual: quantidade },
        message: `${produto.nome}: ${quantidade} unidade(s) em estoque.`,
      };
    },
  },
  {
    nome: "search_sales",
    descricao: "Busca vendas por período, cliente, produto, forma de pagamento, status ou texto livre.",
    recurso: "vendas",
    nivel: 1,
    exigeEscrita: false,
    parametros: {
      type: "object",
      properties: {
        dataInicio: { type: "string", description: "Data ISO (YYYY-MM-DD)" },
        dataFim: { type: "string", description: "Data ISO (YYYY-MM-DD)" },
        clienteId: { type: "string" },
        produtoId: { type: "string" },
        formaPagamento: { type: "string", enum: ["DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO", "PIX"] },
        status: { type: "string", enum: ["CONCLUIDA", "CANCELADA", "DEVOLVIDA_PARCIAL", "DEVOLVIDA_TOTAL"] },
        busca: { type: "string", description: "Texto livre: id da venda, nome/telefone do cliente ou nome do produto" },
      },
    },
    handler: async (args, usuario) => {
      const filtros: FiltrosVendas = { porPagina: 15 };
      const dataInicio = texto(args.dataInicio);
      const dataFim = texto(args.dataFim);
      if (dataInicio) filtros.dataInicio = limitesDoDia(dataInicio).inicio;
      if (dataFim) filtros.dataFim = limitesDoDia(dataFim).fim;
      const clienteId = texto(args.clienteId);
      if (clienteId) filtros.clienteId = clienteId;
      const produtoId = texto(args.produtoId);
      if (produtoId) filtros.produtoId = produtoId;
      const formaPagamento = texto(args.formaPagamento);
      if (formaPagamento) filtros.formaPagamento = formaPagamento as FormaPagamento;
      const status = texto(args.status);
      if (status) filtros.status = status as StatusVenda;
      const busca = texto(args.busca);
      if (busca) filtros.busca = busca;

      // Mesma regra das telas: vendedor não enxerga venda cancelada, nem
      // perguntando ao assistente.
      filtros.ocultarCanceladas = !podeVerVendasCanceladas(usuario.papel);

      const resultado = await listarVendas(filtros);
      const resumo = resultado.vendas.map((venda) => ({
        id: venda.id,
        dataHora: venda.dataHora,
        cliente: venda.cliente?.nome ?? null,
        total: centavosParaReais(venda.total),
        formaPagamento: venda.formaPagamento,
        status: venda.status,
        quantidadeItens: venda.itens.length,
      }));
      return {
        success: true,
        data: { vendas: resumo, total: resultado.total },
        message:
          resultado.total === 0
            ? "Nenhuma venda encontrada com esses filtros."
            : `${resultado.total} venda(s) encontrada(s)${resultado.total > 15 ? ", mostrando as 15 mais recentes" : ""}.`,
      };
    },
  },
  {
    nome: "get_sale",
    descricao: "Busca os detalhes completos de uma venda específica pelo id.",
    recurso: "vendas",
    nivel: 1,
    exigeEscrita: false,
    parametros: {
      type: "object",
      properties: { vendaId: { type: "string" } },
      required: ["vendaId"],
    },
    handler: async (args) => {
      const vendaId = texto(args.vendaId) ?? "";
      const venda = await buscarVendaPorId(vendaId);
      if (!venda) {
        return { success: false, error_code: "VENDA_NAO_ENCONTRADA", message: "Venda não encontrada." };
      }
      return {
        success: true,
        data: {
          id: venda.id,
          dataHora: venda.dataHora,
          cliente: venda.cliente?.nome ?? null,
          status: venda.status,
          formaPagamento: venda.formaPagamento,
          total: centavosParaReais(venda.total),
          valorPago: centavosParaReais(venda.valorPago),
          saldoDevedor: centavosParaReais(Math.max(0, venda.total - venda.valorPago)),
          itens: venda.itens.map((item) => ({
            produto: item.produto.nome,
            quantidade: item.quantidade,
            precoUnitario: centavosParaReais(item.precoUnitario),
          })),
        },
        message: `Venda ${venda.id}: ${centavosParaReais(venda.total)}, status ${venda.status}.`,
      };
    },
  },
  {
    nome: "search_suppliers",
    descricao: "Busca fornecedores cadastrados por nome (parcial, ignora acentuação).",
    recurso: "fornecedores",
    nivel: 1,
    exigeEscrita: false,
    parametros: {
      type: "object",
      properties: { termo: { type: "string" } },
    },
    handler: async (args) => {
      const termo = texto(args.termo);
      const resultados = (await listarFornecedores(termo)).slice(0, 10);
      return {
        success: true,
        data: resultados.map((f) => ({ id: f.id, nome: f.nome, telefone: f.telefone })),
        message: resultados.length === 0 ? "Nenhum fornecedor encontrado." : `${resultados.length} fornecedor(es) encontrado(s).`,
      };
    },
  },
  {
    nome: "search_purchase_orders",
    descricao:
      "Busca pedidos de compra a fornecedores por status (rascunho/enviado/recebido/cancelado), fornecedor ou período.",
    recurso: "compras",
    nivel: 1,
    exigeEscrita: false,
    parametros: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["RASCUNHO", "ENVIADO", "RECEBIDO", "CANCELADO"] },
        busca: { type: "string", description: "Texto livre: id do pedido ou nome do fornecedor" },
        dataInicio: { type: "string", description: "Data ISO (YYYY-MM-DD)" },
        dataFim: { type: "string", description: "Data ISO (YYYY-MM-DD)" },
      },
    },
    handler: async (args) => {
      const filtros: FiltrosPedidos = { porPagina: 15 };
      const status = texto(args.status);
      if (status) filtros.status = status as FiltrosPedidos["status"];
      const busca = texto(args.busca);
      if (busca) filtros.busca = busca;
      const dataInicio = texto(args.dataInicio);
      const dataFim = texto(args.dataFim);
      if (dataInicio) filtros.dataInicio = limitesDoDia(dataInicio).inicio;
      if (dataFim) filtros.dataFim = limitesDoDia(dataFim).fim;

      const resultado = await listarPedidos(filtros);
      const resumo = resultado.pedidos.map((pedido) => ({
        id: pedido.id,
        fornecedor: pedido.fornecedor.nome,
        status: pedido.status,
        dataPedido: pedido.dataPedido,
        quantidadeItens: pedido.itens.length,
      }));
      return {
        success: true,
        data: { pedidos: resumo, total: resultado.total },
        message:
          resultado.total === 0
            ? "Nenhum pedido de compra encontrado com esses filtros."
            : `${resultado.total} pedido(s) encontrado(s)${resultado.total > 15 ? ", mostrando os 15 mais recentes" : ""}.`,
      };
    },
  },
  {
    nome: "get_purchase_order",
    descricao: "Busca os detalhes completos de um pedido de compra específico pelo id (itens, fornecedor, status, frete).",
    recurso: "compras",
    nivel: 1,
    exigeEscrita: false,
    parametros: {
      type: "object",
      properties: { pedidoId: { type: "string" } },
      required: ["pedidoId"],
    },
    handler: async (args) => {
      const pedidoId = texto(args.pedidoId) ?? "";
      const pedido = await buscarPedidoPorId(pedidoId);
      if (!pedido) {
        return { success: false, error_code: "PEDIDO_NAO_ENCONTRADO", message: "Pedido de compra não encontrado." };
      }
      return {
        success: true,
        data: {
          id: pedido.id,
          fornecedor: pedido.fornecedor.nome,
          status: pedido.status,
          dataPedido: pedido.dataPedido,
          valorFrete: centavosParaReais(pedido.valorFrete),
          observacoes: pedido.observacoes,
          itens: pedido.itens.map((item) => ({
            produto: item.produto.nome,
            quantidade: item.quantidade,
            quantidadeDemonstracao: item.quantidadeDemonstracao,
            custoUnitario: centavosParaReais(item.custoUnitario),
          })),
        },
        message: `Pedido ${pedido.id.slice(-6)}: fornecedor ${pedido.fornecedor.nome}, status ${pedido.status}, ${pedido.itens.length} item(ns).`,
      };
    },
  },
  {
    nome: "search_expenses",
    descricao: "Busca despesas por período, categoria, status (pendente/pago/vencido/cancelado) ou texto livre na descrição.",
    recurso: "despesas",
    nivel: 1,
    exigeEscrita: false,
    parametros: {
      type: "object",
      properties: {
        dataInicio: { type: "string", description: "Data ISO (YYYY-MM-DD)" },
        dataFim: { type: "string", description: "Data ISO (YYYY-MM-DD)" },
        status: { type: "string", enum: ["pendente", "pago", "vencido", "cancelado"] },
        busca: { type: "string", description: "Texto livre na descrição da despesa" },
      },
    },
    handler: async (args) => {
      const filtros: FiltrosDespesas = { porPagina: 15 };
      const dataInicio = texto(args.dataInicio);
      const dataFim = texto(args.dataFim);
      if (dataInicio) filtros.dataInicio = limitesDoDia(dataInicio).inicio;
      if (dataFim) filtros.dataFim = limitesDoDia(dataFim).fim;
      const status = texto(args.status);
      if (status) filtros.status = status as FiltrosDespesas["status"];
      const busca = texto(args.busca);
      if (busca) filtros.busca = busca;

      const resultado = await listarDespesas(filtros);
      const resumo = resultado.despesas.map((d) => ({
        id: d.id,
        descricao: d.descricao,
        valor: centavosParaReais(d.valor),
        categoria: d.categoria.nome,
        status: d.status,
        dataDespesa: d.dataDespesa,
        vencimento: d.vencimento,
      }));
      return {
        success: true,
        data: { despesas: resumo, total: resultado.total },
        message:
          resultado.total === 0
            ? "Nenhuma despesa encontrada com esses filtros."
            : `${resultado.total} despesa(s) encontrada(s)${resultado.total > 15 ? ", mostrando as 15 mais recentes" : ""}.`,
      };
    },
  },
  {
    nome: "get_dashboard_metrics",
    descricao: "Consulta os indicadores gerais do dashboard: faturamento de hoje, faturamento do mês, ticket médio e vendas recentes.",
    recurso: "vendas",
    nivel: 1,
    exigeEscrita: false,
    parametros: { type: "object", properties: {} },
    handler: async () => {
      const resumo = await resumoDashboard();
      return {
        success: true,
        data: {
          faturamentoDiaFormatado: centavosParaReais(resumo.faturamentoDia.totalCentavos),
          vendasDia: resumo.faturamentoDia.quantidadeVendas,
          faturamentoMesFormatado: centavosParaReais(resumo.faturamentoMes.totalCentavos),
          vendasMes: resumo.faturamentoMes.quantidadeVendas,
          ticketMedioMesFormatado: centavosParaReais(resumo.ticketMedioMes),
        },
        message: `Faturamento de hoje: ${centavosParaReais(resumo.faturamentoDia.totalCentavos)}. Faturamento no mês: ${centavosParaReais(resumo.faturamentoMes.totalCentavos)}.`,
      };
    },
  },
  {
    nome: "get_profit_report",
    descricao:
      "Consulta faturamento, CMV, lucro bruto, despesas operacionais e lucro líquido de um período. Só disponível para quem tem permissão de ver custo/lucro.",
    recurso: "relatorios",
    nivel: 1,
    exigeEscrita: false,
    exigeVerCustos: true,
    parametros: {
      type: "object",
      properties: {
        periodo: { type: "string", enum: CHAVES_PERIODO, description: "Período pré-definido" },
        dataInicio: { type: "string", description: "Alternativa a 'periodo': data ISO de início" },
        dataFim: { type: "string", description: "Alternativa a 'periodo': data ISO de fim" },
        regime: { type: "string", enum: ["caixa", "competencia"] },
      },
    },
    handler: async (args) => {
      const periodoResolvido = resolverPeriodoArgs(args);
      const regime = (texto(args.regime) as Regime | undefined) ?? "competencia";
      const indicadores = await indicadoresLucro(periodoResolvido, regime);
      return {
        success: true,
        // Só valores já formatados em R$ — nunca centavos crus, para o modelo
        // não fazer conta de conversão sozinho e errar a casa decimal.
        data: {
          periodo: `${periodoResolvido.inicio.toLocaleDateString("pt-BR")} a ${periodoResolvido.fim.toLocaleDateString("pt-BR")}`,
          faturamentoBruto: centavosParaReais(indicadores.faturamentoBruto),
          descontos: centavosParaReais(indicadores.descontos),
          devolucoes: centavosParaReais(indicadores.devolucoes),
          faturamentoLiquido: centavosParaReais(indicadores.faturamentoLiquido),
          cmv: centavosParaReais(indicadores.cmv),
          lucroBruto: centavosParaReais(indicadores.lucroBruto),
          despesasOperacionais: centavosParaReais(indicadores.despesasOperacionais),
          lucroLiquido: centavosParaReais(indicadores.lucroLiquido),
          margemBruta: `${indicadores.margemBruta.toFixed(1)}%`,
          margemLiquida: `${indicadores.margemLiquida.toFixed(1)}%`,
          ticketMedio: centavosParaReais(indicadores.ticketMedio),
          qtdVendas: indicadores.qtdVendas,
        },
        message: `De ${periodoResolvido.inicio.toLocaleDateString("pt-BR")} a ${periodoResolvido.fim.toLocaleDateString("pt-BR")}: faturamento líquido ${centavosParaReais(indicadores.faturamentoLiquido)}, lucro líquido ${centavosParaReais(indicadores.lucroLiquido)}.`,
      };
    },
  },
  {
    nome: "get_customer_report",
    descricao:
      "Consulta indicadores de um cliente específico (se clienteId for informado) ou um ranking de clientes por gasto total num período.",
    recurso: "relatorios",
    nivel: 1,
    exigeEscrita: false,
    parametros: {
      type: "object",
      properties: {
        clienteId: { type: "string" },
        dataInicio: { type: "string" },
        dataFim: { type: "string" },
      },
    },
    handler: async (args) => {
      const clienteId = texto(args.clienteId);
      if (clienteId) {
        const indicadores = await indicadoresDoCliente(clienteId);
        return {
          success: true,
          data: {
            totalGasto: centavosParaReais(indicadores.totalGastoCentavos),
            numeroCompras: indicadores.numeroCompras,
            ticketMedio: centavosParaReais(indicadores.ticketMedioCentavos),
            primeiraCompra: indicadores.primeiraCompra,
            ultimaCompra: indicadores.ultimaCompra,
            diasDesdeUltimaCompra: indicadores.diasDesdeUltimaCompra,
            produtoFavorito: indicadores.produtoFavorito,
            marcaPreferida: indicadores.marcaPreferida,
            categoriaPreferida: indicadores.categoriaPreferida,
          },
          message: `Total gasto: ${centavosParaReais(indicadores.totalGastoCentavos)} em ${indicadores.numeroCompras} compra(s).`,
        };
      }

      const filtros: FiltrosRanking = { porPagina: 10 };
      const dataInicio = texto(args.dataInicio);
      const dataFim = texto(args.dataFim);
      if (dataInicio) filtros.dataInicio = limitesDoDia(dataInicio).inicio;
      if (dataFim) filtros.dataFim = limitesDoDia(dataFim).fim;

      const resultado = await rankingClientes(filtros);
      return {
        success: true,
        data: resultado.linhas.map((linha) => ({
          nome: linha.nome,
          totalGasto: centavosParaReais(linha.totalGastoCentavos),
          numeroCompras: linha.numeroCompras,
        })),
        message: resultado.linhas.length === 0 ? "Nenhum cliente encontrado nesse período." : `Top ${resultado.linhas.length} cliente(s) por gasto.`,
      };
    },
  },
  {
    nome: "get_inventory_report",
    descricao: "Consulta a visão geral do estoque: quantidade atual, estoque de demonstracao e status (sem estoque/baixo/ok) de cada produto ativo.",
    recurso: "estoque",
    nivel: 1,
    exigeEscrita: false,
    parametros: { type: "object", properties: {} },
    handler: async (_args, usuario) => {
      const visao = await listarVisaoEstoque();
      const podeCusto = podeVerCustos(usuario.papel);
      const semEstoque = visao.filter((v) => v.status === "sem_estoque").length;
      const baixo = visao.filter((v) => v.status === "baixo").length;
      return {
        success: true,
        data: visao.map((v) => ({
          produto: v.produto.nome,
          quantidadeAtual: v.quantidadeAtual,
          quantidadeDemonstracao: v.quantidadeDemonstracao,
          status: v.status,
          ...(podeCusto ? { custoMedio: centavosParaReais(v.custoMedio) } : {}),
        })),
        message: `${visao.length} produto(s) ativo(s): ${semEstoque} sem estoque, ${baixo} com estoque baixo.`,
      };
    },
  },
];
