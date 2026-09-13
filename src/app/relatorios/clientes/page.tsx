import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import {
  indicadoresClientes,
  rankingClientes,
  clientesInativos,
  segmentosClientes,
  type FiltrosRanking,
  type Segmentos,
} from "@/lib/clientes-relatorio";
import { montarLinkWhatsApp } from "@/lib/whatsapp";
import { resolverPeriodo, type ChavePeriodo } from "@/lib/lucro";
import { centavosParaReais } from "@/lib/money";
import { nicho } from "@/config/nicho";

type SearchParams = {
  periodo?: ChavePeriodo;
  dataInicio?: string;
  dataFim?: string;
  categoria?: string;
  marca?: string;
  valorMinimo?: string;
  valorMaximo?: string;
  numeroComprasMinimo?: string;
  ultimaCompraDias?: string;
  pagina?: string;
  diasInatividade?: string;
};

const LABEL_PERIODO: Record<ChavePeriodo, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7dias": "Últimos 7 dias",
  mesAtual: "Mês atual",
  mesAnterior: "Mês anterior",
  custom: "Período personalizado",
};

// Segmentos de comportamento — valem para qualquer negócio. Os perfis de
// compra ("quem leva o quê") são definidos por nicho em src/config/nicho.ts.
const SEGMENTOS_COMPORTAMENTO: Array<{ chave: keyof Omit<Segmentos, "perfisCompra">; rotulo: string }> = [
  { chave: "novos", rotulo: "Novos (30 dias)" },
  { chave: "recorrentes", rotulo: "Recorrentes" },
  { chave: "vip", rotulo: "VIP" },
  { chave: "altoTicket", rotulo: "Alto ticket" },
  { chave: "inativos", rotulo: "Inativos" },
  { chave: "recuperados", rotulo: "Recuperados" },
];

export default async function RelatorioClientesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const usuario = await requireLeitura("relatorios");
  const params = await searchParams;

  const chavePeriodo = params.periodo ?? "mesAtual";
  const periodo = resolverPeriodo(
    chavePeriodo,
    params.dataInicio && params.dataFim ? { inicio: new Date(params.dataInicio), fim: new Date(params.dataFim) } : undefined
  );
  const diasInatividade = params.diasInatividade ? Number(params.diasInatividade) : 90;

  const filtrosRanking: FiltrosRanking = {
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
    categoria: params.categoria || undefined,
    marca: params.marca || undefined,
    valorMinimoCentavos: params.valorMinimo ? Math.round(Number(params.valorMinimo) * 100) : undefined,
    valorMaximoCentavos: params.valorMaximo ? Math.round(Number(params.valorMaximo) * 100) : undefined,
    numeroComprasMinimo: params.numeroComprasMinimo ? Number(params.numeroComprasMinimo) : undefined,
    ultimaCompraDias: params.ultimaCompraDias ? Number(params.ultimaCompraDias) : undefined,
    pagina: params.pagina ? Number(params.pagina) : 1,
    porPagina: 20,
  };

  const [indicadores, ranking, inativos, segmentos] = await Promise.all([
    indicadoresClientes(periodo),
    rankingClientes(filtrosRanking),
    clientesInativos(diasInatividade),
    segmentosClientes(),
  ]);

  const cartoes = [
    { titulo: "Total de clientes cadastrados", valor: String(indicadores.totalCadastrados) },
    { titulo: "Compraram no período", valor: String(indicadores.compraramNoPeriodo) },
    { titulo: "Novos (no período)", valor: String(indicadores.novos) },
    { titulo: "Recorrentes (no período)", valor: String(indicadores.recorrentes) },
    { titulo: "Inativos", valor: String(indicadores.inativos) },
    { titulo: "Taxa de recompra", valor: `${indicadores.taxaRecompra.toFixed(1)}%` },
    { titulo: "Ticket médio por cliente", valor: centavosParaReais(indicadores.ticketMedioPorCliente) },
    { titulo: "Frequência média de compra", valor: indicadores.frequenciaMediaCompra.toFixed(1) },
    { titulo: "Tempo médio entre compras", valor: indicadores.tempoMedioEntreComprasDias !== null ? `${indicadores.tempoMedioEntreComprasDias.toFixed(0)} dias` : "—" },
    { titulo: "Receita por cliente", valor: centavosParaReais(indicadores.receitaPorClienteCentavos) },
  ];

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader
        title="Relatórios de clientes"
        action={
          <a
            href={`/api/relatorios/clientes/exportar?periodo=${chavePeriodo}${params.dataInicio ? `&dataInicio=${params.dataInicio}` : ""}${params.dataFim ? `&dataFim=${params.dataFim}` : ""}${params.categoria ? `&categoria=${encodeURIComponent(params.categoria)}` : ""}${params.marca ? `&marca=${encodeURIComponent(params.marca)}` : ""}`}
            className="btn btn-outline"
          >
            Exportar CSV
          </a>
        }
      />

      <form className="card mb-8 grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
        <select name="periodo" defaultValue={chavePeriodo} className="input">
          {(Object.keys(LABEL_PERIODO) as ChavePeriodo[]).map((chave) => (
            <option key={chave} value={chave}>
              {LABEL_PERIODO[chave]}
            </option>
          ))}
        </select>
        <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="input" placeholder="Início (personalizado)" />
        <input type="date" name="dataFim" defaultValue={params.dataFim} className="input" placeholder="Fim (personalizado)" />
        <input name="categoria" defaultValue={params.categoria} placeholder="Categoria preferida" className="input" />
        <input name="marca" defaultValue={params.marca} placeholder="Marca preferida" className="input" />
        <input type="number" step="0.01" name="valorMinimo" defaultValue={params.valorMinimo} placeholder="Gasto mínimo (R$)" className="input" />
        <input type="number" step="0.01" name="valorMaximo" defaultValue={params.valorMaximo} placeholder="Gasto máximo (R$)" className="input" />
        <input type="number" name="numeroComprasMinimo" defaultValue={params.numeroComprasMinimo} placeholder="Nº mínimo de compras" className="input" />
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
          <Link href="/relatorios/clientes" className="btn btn-outline">
            Limpar
          </Link>
        </div>
      </form>

      <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cartoes.map((cartao) => (
          <div key={cartao.titulo} className="card p-5">
            <p className="label-caps mb-1">{cartao.titulo}</p>
            <p className="text-xl font-bold">{cartao.valor}</p>
          </div>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="label-caps mb-3">Segmentos automáticos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {SEGMENTOS_COMPORTAMENTO.map(({ chave, rotulo }) => (
            <div key={chave} className="card p-4">
              <p className="label-caps mb-1">{rotulo}</p>
              <p className="text-lg font-bold">{segmentos[chave]}</p>
            </div>
          ))}
        </div>
      </section>

      {segmentos.perfisCompra.length > 0 && (
        <section className="mb-10">
          <h2 className="label-caps mb-3">Perfis de compra</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {segmentos.perfisCompra.map((perfil) => (
              <div key={perfil.chave} className="card p-4">
                <p className="label-caps mb-1">{perfil.rotulo}</p>
                <p className="text-lg font-bold">{perfil.total}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="label-caps mb-3">Ranking de clientes</h2>
        {ranking.linhas.length === 0 ? (
          <p className="state-empty">Nenhum cliente encontrado com esses filtros.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="p-2">Nome</th>
                  <th className="p-2">Telefone</th>
                  <th className="p-2">Total gasto</th>
                  <th className="p-2">Nº compras</th>
                  <th className="p-2">Ticket médio</th>
                  <th className="p-2">Última compra</th>
                  <th className="p-2">Produto favorito</th>
                  <th className="p-2">Categoria</th>
                  <th className="p-2">Marca</th>
                </tr>
              </thead>
              <tbody>
                {ranking.linhas.map((linha) => (
                  <tr key={linha.clienteId} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="p-2">
                      <Link href={`/clientes/${linha.clienteId}`} className="font-medium underline">
                        {linha.nome}
                      </Link>
                    </td>
                    <td className="p-2">{linha.telefone ?? "—"}</td>
                    <td className="p-2 font-semibold">{centavosParaReais(linha.totalGastoCentavos)}</td>
                    <td className="p-2">{linha.numeroCompras}</td>
                    <td className="p-2">{centavosParaReais(linha.ticketMedioCentavos)}</td>
                    <td className="p-2">{linha.ultimaCompra.toLocaleDateString("pt-BR")}</td>
                    <td className="p-2">{linha.produtoMaisComprado ?? "—"}</td>
                    <td className="p-2">{linha.categoriaPreferida ?? "—"}</td>
                    <td className="p-2">{linha.marcaPreferida ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {ranking.total} cliente(s) no total
            </p>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="label-caps">Clientes inativos</h2>
          <form className="flex gap-2">
            <input type="hidden" name="periodo" value={chavePeriodo} />
            <select name="diasInatividade" defaultValue={String(diasInatividade)} className="input" style={{ width: "auto" }}>
              <option value="30">Sem comprar há 30 dias</option>
              <option value="60">Sem comprar há 60 dias</option>
              <option value="90">Sem comprar há 90 dias</option>
              <option value="180">Sem comprar há 180 dias</option>
            </select>
            <button type="submit" className="btn btn-outline">
              Aplicar
            </button>
          </form>
        </div>
        {inativos.length === 0 ? (
          <p className="state-empty">Nenhum cliente inativo com esse corte.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="p-2">Nome</th>
                  <th className="p-2">Última compra</th>
                  <th className="p-2">Dias sem comprar</th>
                  <th className="p-2">Total histórico</th>
                  <th className="p-2">Produto favorito</th>
                  <th className="p-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {inativos.slice(0, 50).map((cliente) => {
                  const link = montarLinkWhatsApp(cliente.telefone, `Olá ${cliente.nome}! Sentimos sua falta na ${nicho.negocio.nome}!`);
                  return (
                    <tr key={cliente.clienteId} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="p-2">
                        <Link href={`/clientes/${cliente.clienteId}`} className="font-medium underline">
                          {cliente.nome}
                        </Link>
                      </td>
                      <td className="p-2">{cliente.ultimaCompra ? cliente.ultimaCompra.toLocaleDateString("pt-BR") : "Nunca comprou"}</td>
                      <td className="p-2">{cliente.diasSemComprar ?? "—"}</td>
                      <td className="p-2">{centavosParaReais(cliente.totalHistoricoCentavos)}</td>
                      <td className="p-2">{cliente.produtoMaisComprado ?? "—"}</td>
                      <td className="p-2">
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                            WhatsApp
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
