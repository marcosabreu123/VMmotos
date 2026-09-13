import Link from "next/link";
import { redirect } from "next/navigation";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { podeVerCustos } from "@/lib/permissoes";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GraficoBarras, GraficoLinha, GraficoPizza } from "@/components/charts/GraficoSvg";
import { indicadoresLucro, detalhamentoLucro, resolverPeriodo, type ChavePeriodo, type Regime, type AgrupamentoLucro } from "@/lib/lucro";
import { despesasPorCategoria } from "@/lib/relatorio-despesas";
import { centavosParaReais } from "@/lib/money";

type SearchParams = {
  periodo?: ChavePeriodo;
  dataInicio?: string;
  dataFim?: string;
  regime?: Regime;
  agrupamento?: AgrupamentoLucro;
};

const LABEL_PERIODO: Record<ChavePeriodo, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7dias": "Últimos 7 dias",
  mesAtual: "Mês atual",
  mesAnterior: "Mês anterior",
  custom: "Período personalizado",
};

const LABEL_AGRUPAMENTO: Record<AgrupamentoLucro, string> = {
  produto: "Produto",
  categoria: "Categoria",
  marca: "Marca",
  tipoVenda: "Tipo de produto",
  formaPagamento: "Forma de pagamento",
  vendedor: "Vendedor",
  dia: "Dia",
  semana: "Semana",
  mes: "Mês",
};

function centavosParaNumero(centavos: number): number {
  return Math.round(centavos) / 100;
}

export default async function RelatorioLucroPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const usuario = await requireLeitura("relatorios");
  if (!podeVerCustos(usuario.papel)) redirect("/relatorios");

  const params = await searchParams;
  const chavePeriodo = params.periodo ?? "mesAtual";
  const regime = params.regime ?? "competencia";
  const agrupamento = params.agrupamento ?? "produto";

  const periodo = resolverPeriodo(
    chavePeriodo,
    params.dataInicio && params.dataFim
      ? { inicio: new Date(params.dataInicio), fim: new Date(params.dataFim) }
      : undefined
  );

  const [indicadores, detalhamento, porDia, porProduto, porCategoriaLucro, despesasCategoria] = await Promise.all([
    indicadoresLucro(periodo, regime),
    detalhamentoLucro(periodo, agrupamento),
    detalhamentoLucro(periodo, "dia"),
    detalhamentoLucro(periodo, "produto"),
    detalhamentoLucro(periodo, "categoria"),
    despesasPorCategoria(periodo),
  ]);

  const cartoes: Array<{ titulo: string; valor: string }> = [
    { titulo: "Faturamento bruto", valor: centavosParaReais(indicadores.faturamentoBruto) },
    { titulo: "Descontos concedidos", valor: centavosParaReais(indicadores.descontos) },
    { titulo: "Devoluções", valor: centavosParaReais(indicadores.devolucoes) },
    { titulo: "Faturamento líquido", valor: centavosParaReais(indicadores.faturamentoLiquido) },
    { titulo: "Custo da mercadoria vendida", valor: centavosParaReais(indicadores.cmv) },
    { titulo: "Lucro bruto", valor: centavosParaReais(indicadores.lucroBruto) },
    { titulo: "Despesas operacionais", valor: centavosParaReais(indicadores.despesasOperacionais) },
    { titulo: "Custo total da operação", valor: centavosParaReais(indicadores.cmv + indicadores.despesasOperacionais) },
    { titulo: "Lucro líquido", valor: centavosParaReais(indicadores.lucroLiquido) },
    { titulo: "Margem bruta", valor: `${indicadores.margemBruta.toFixed(1)}%` },
    { titulo: "Margem líquida", valor: `${indicadores.margemLiquida.toFixed(1)}%` },
    { titulo: "Ticket médio", valor: centavosParaReais(indicadores.ticketMedio) },
    { titulo: "Quantidade de vendas", valor: String(indicadores.qtdVendas) },
  ];

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader
        title="Relatório de lucro"
        action={
          <a
            href={`/api/relatorios/lucro/exportar?periodo=${chavePeriodo}&agrupamento=${agrupamento}${params.dataInicio ? `&dataInicio=${params.dataInicio}` : ""}${params.dataFim ? `&dataFim=${params.dataFim}` : ""}`}
            className="btn btn-outline"
          >
            Exportar CSV
          </a>
        }
      />

      <form className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-5">
        <select name="periodo" defaultValue={chavePeriodo} className="input">
          {(Object.keys(LABEL_PERIODO) as ChavePeriodo[]).map((chave) => (
            <option key={chave} value={chave}>
              {LABEL_PERIODO[chave]}
            </option>
          ))}
        </select>
        <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="input" placeholder="Início (personalizado)" />
        <input type="date" name="dataFim" defaultValue={params.dataFim} className="input" placeholder="Fim (personalizado)" />
        <select name="regime" defaultValue={regime} className="input">
          <option value="competencia">Regime de competência</option>
          <option value="caixa">Regime de caixa</option>
        </select>
        <select name="agrupamento" defaultValue={agrupamento} className="input">
          {(Object.keys(LABEL_AGRUPAMENTO) as AgrupamentoLucro[]).map((chave) => (
            <option key={chave} value={chave}>
              Detalhar por {LABEL_AGRUPAMENTO[chave]}
            </option>
          ))}
        </select>
        <div className="flex gap-2 sm:col-span-5">
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
          <Link href="/relatorios/lucro" className="btn btn-outline">
            Limpar
          </Link>
        </div>
      </form>

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cartoes.map((cartao) => (
          <div key={cartao.titulo} className="card p-5">
            <p className="label-caps mb-1">{cartao.titulo}</p>
            <p className="text-xl font-bold">{cartao.valor}</p>
          </div>
        ))}
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="label-caps mb-3">Faturamento vs. lucro</h2>
          <GraficoBarras
            dados={[
              { label: "Faturamento líquido", valor: centavosParaNumero(indicadores.faturamentoLiquido) },
              { label: "Lucro bruto", valor: centavosParaNumero(indicadores.lucroBruto) },
              { label: "Lucro líquido", valor: centavosParaNumero(indicadores.lucroLiquido) },
            ]}
          />
        </div>
        <div className="card p-5">
          <h2 className="label-caps mb-3">Composição do faturamento</h2>
          <GraficoBarras
            dados={[
              { label: "Bruto", valor: centavosParaNumero(indicadores.faturamentoBruto) },
              { label: "Descontos", valor: centavosParaNumero(indicadores.descontos) },
              { label: "Devoluções", valor: centavosParaNumero(indicadores.devolucoes) },
              { label: "Líquido", valor: centavosParaNumero(indicadores.faturamentoLiquido) },
            ]}
          />
        </div>
        <div className="card p-5">
          <h2 className="label-caps mb-3">Evolução do lucro líquido (bruto por dia, no período)</h2>
          <GraficoLinha
            dados={porDia
              .slice()
              .sort((a, b) => a.chave.localeCompare(b.chave))
              .map((linha) => ({ label: linha.label, valor: centavosParaNumero(linha.lucroBruto) }))}
          />
        </div>
        <div className="card p-5">
          <h2 className="label-caps mb-3">Despesas por categoria</h2>
          <GraficoPizza
            dados={despesasCategoria.map((linha) => ({ label: linha.categoria, valor: centavosParaNumero(linha.totalCentavos) }))}
          />
        </div>
        <div className="card p-5">
          <h2 className="label-caps mb-3">Produtos mais lucrativos</h2>
          <GraficoBarras dados={porProduto.slice(0, 5).map((linha) => ({ label: linha.label, valor: centavosParaNumero(linha.lucroBruto) }))} />
        </div>
        <div className="card p-5">
          <h2 className="label-caps mb-3">Categorias mais lucrativas</h2>
          <GraficoBarras dados={porCategoriaLucro.slice(0, 5).map((linha) => ({ label: linha.label, valor: centavosParaNumero(linha.lucroBruto) }))} />
        </div>
      </section>

      <section>
        <h2 className="label-caps mb-3">Detalhamento por {LABEL_AGRUPAMENTO[agrupamento]}</h2>
        {detalhamento.length === 0 ? (
          <p className="state-empty">Nenhuma venda no período selecionado.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="p-2">{LABEL_AGRUPAMENTO[agrupamento]}</th>
                  <th className="p-2">Faturamento</th>
                  <th className="p-2">Custo</th>
                  <th className="p-2">Lucro bruto</th>
                  <th className="p-2">Margem</th>
                  <th className="p-2">Qtd.</th>
                </tr>
              </thead>
              <tbody>
                {detalhamento.map((linha) => (
                  <tr key={linha.chave} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="p-2">{linha.label}</td>
                    <td className="p-2">{centavosParaReais(linha.faturamento)}</td>
                    <td className="p-2">{centavosParaReais(linha.custo)}</td>
                    <td className="p-2 font-semibold">{centavosParaReais(linha.lucroBruto)}</td>
                    <td className="p-2">{linha.margem.toFixed(1)}%</td>
                    <td className="p-2">{linha.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
