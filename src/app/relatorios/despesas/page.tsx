import Link from "next/link";
import { redirect } from "next/navigation";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { podeVerCustos } from "@/lib/permissoes";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { GraficoBarras, GraficoPizza } from "@/components/charts/GraficoSvg";
import { resolverPeriodo, type ChavePeriodo } from "@/lib/lucro";
import {
  indicadoresDespesas,
  despesasPorCategoria,
  despesasAgrupadas,
  periodoAnterior,
  type AgrupamentoDespesas,
} from "@/lib/relatorio-despesas";
import { centavosParaReais } from "@/lib/money";

type SearchParams = {
  periodo?: ChavePeriodo;
  dataInicio?: string;
  dataFim?: string;
  agrupamento?: AgrupamentoDespesas;
};

const LABEL_PERIODO: Record<ChavePeriodo, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7dias": "Últimos 7 dias",
  mesAtual: "Mês atual",
  mesAnterior: "Mês anterior",
  custom: "Período personalizado",
};

const LABEL_AGRUPAMENTO: Record<AgrupamentoDespesas, string> = {
  categoria: "Categoria",
  status: "Status",
  formaPagamento: "Forma de pagamento",
  recorrencia: "Recorrência",
  usuario: "Usuário responsável",
  mes: "Mês",
};

function centavosParaNumero(centavos: number): number {
  return Math.round(centavos) / 100;
}

function variacaoPercentual(atual: number, anterior: number): string {
  if (anterior === 0) return atual === 0 ? "0%" : "—";
  const variacao = ((atual - anterior) / anterior) * 100;
  const sinal = variacao > 0 ? "+" : "";
  return `${sinal}${variacao.toFixed(1)}%`;
}

export default async function RelatorioDespesasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const usuario = await requireLeitura("relatorios");
  if (!podeVerCustos(usuario.papel)) redirect("/relatorios");

  const params = await searchParams;
  const chavePeriodo = params.periodo ?? "mesAtual";
  const agrupamento = params.agrupamento ?? "categoria";

  const periodo = resolverPeriodo(
    chavePeriodo,
    params.dataInicio && params.dataFim
      ? { inicio: new Date(params.dataInicio), fim: new Date(params.dataFim) }
      : undefined
  );
  const anterior = periodoAnterior(periodo);

  const [indicadores, indicadoresAnteriores, categorias, agrupadas] = await Promise.all([
    indicadoresDespesas(periodo),
    indicadoresDespesas(anterior),
    despesasPorCategoria(periodo),
    despesasAgrupadas(periodo, agrupamento),
  ]);

  const cartoes = [
    { titulo: "Total de despesas", valor: centavosParaReais(indicadores.totalCentavos), comparacao: variacaoPercentual(indicadores.totalCentavos, indicadoresAnteriores.totalCentavos) },
    { titulo: "Pagas", valor: `${centavosParaReais(indicadores.pagasCentavos)} (${indicadores.pagas})` },
    { titulo: "Pendentes", valor: `${centavosParaReais(indicadores.pendentesCentavos)} (${indicadores.pendentes})` },
    { titulo: "Vencidas", valor: `${centavosParaReais(indicadores.vencidasCentavos)} (${indicadores.vencidas})` },
    { titulo: "Fixas", valor: centavosParaReais(indicadores.fixasCentavos) },
    { titulo: "Variáveis", valor: centavosParaReais(indicadores.variaveisCentavos) },
    { titulo: "Média mensal (no período)", valor: centavosParaReais(indicadores.mediaMensalCentavos) },
    { titulo: "Maior categoria de gasto", valor: indicadores.maiorCategoria ? `${indicadores.maiorCategoria.nome} · ${centavosParaReais(indicadores.maiorCategoria.totalCentavos)}` : "—" },
  ];

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader title="Relatório de despesas" action={<Link href="/despesas" className="btn btn-outline">Ver despesas</Link>} />

      <form className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
        <select name="periodo" defaultValue={chavePeriodo} className="input">
          {(Object.keys(LABEL_PERIODO) as ChavePeriodo[]).map((chave) => (
            <option key={chave} value={chave}>
              {LABEL_PERIODO[chave]}
            </option>
          ))}
        </select>
        <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="input" placeholder="Início (personalizado)" />
        <input type="date" name="dataFim" defaultValue={params.dataFim} className="input" placeholder="Fim (personalizado)" />
        <select name="agrupamento" defaultValue={agrupamento} className="input">
          {(Object.keys(LABEL_AGRUPAMENTO) as AgrupamentoDespesas[]).map((chave) => (
            <option key={chave} value={chave}>
              Visualizar por {LABEL_AGRUPAMENTO[chave]}
            </option>
          ))}
        </select>
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
          <Link href="/relatorios/despesas" className="btn btn-outline">
            Limpar
          </Link>
        </div>
      </form>

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cartoes.map((cartao) => (
          <div key={cartao.titulo} className="card p-5">
            <p className="label-caps mb-1">{cartao.titulo}</p>
            <p className="text-xl font-bold">{cartao.valor}</p>
            {cartao.comparacao && (
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {cartao.comparacao} vs. período anterior
              </p>
            )}
          </div>
        ))}
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="label-caps mb-3">Despesas por categoria</h2>
          <GraficoPizza dados={categorias.map((linha) => ({ label: linha.categoria, valor: centavosParaNumero(linha.totalCentavos) }))} />
        </div>
        <div className="card p-5">
          <h2 className="label-caps mb-3">Visualização por {LABEL_AGRUPAMENTO[agrupamento]}</h2>
          <GraficoBarras dados={agrupadas.map((linha) => ({ label: linha.label, valor: centavosParaNumero(linha.totalCentavos) }))} />
        </div>
      </section>

      <section>
        <h2 className="label-caps mb-3">Detalhamento por {LABEL_AGRUPAMENTO[agrupamento]}</h2>
        {agrupadas.length === 0 ? (
          <p className="state-empty">Nenhuma despesa no período selecionado.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="p-2">{LABEL_AGRUPAMENTO[agrupamento]}</th>
                  <th className="p-2">Total</th>
                  <th className="p-2">Qtd.</th>
                </tr>
              </thead>
              <tbody>
                {agrupadas.map((linha) => (
                  <tr key={linha.label} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="p-2">{linha.label}</td>
                    <td className="p-2 font-semibold">{centavosParaReais(linha.totalCentavos)}</td>
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
