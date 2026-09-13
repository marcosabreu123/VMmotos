import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarHistoricoFretes, type FiltrosHistoricoFrete } from "@/lib/integracoes/melhorEnvio/historico";
import { centavosParaReais } from "@/lib/money";

type SearchParams = {
  dataInicio?: string;
  dataFim?: string;
  cepDestino?: string;
  status?: string;
  pagina?: string;
};

const LABEL_STATUS: Record<string, string> = {
  sucesso: "badge-success",
  erro: "badge-danger",
  parcial: "badge-warning",
};

export default async function HistoricoFretesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const usuario = await requireLeitura("fretes");
  const params = await searchParams;

  const filtros: FiltrosHistoricoFrete = {
    dataInicio: params.dataInicio ? new Date(params.dataInicio) : undefined,
    dataFim: params.dataFim ? new Date(`${params.dataFim}T23:59:59`) : undefined,
    cepDestino: params.cepDestino || undefined,
    status: params.status || undefined,
    pagina: params.pagina ? Number(params.pagina) : 1,
    porPagina: 20,
  };

  const { cotacoes, pagina, totalPaginas } = await listarHistoricoFretes(filtros);

  function paginaHref(numero: number) {
    const query = new URLSearchParams();
    for (const [chave, valor] of Object.entries(params)) {
      if (valor && chave !== "pagina") query.set(chave, valor);
    }
    query.set("pagina", String(numero));
    return `/fretes/historico?${query.toString()}`;
  }

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader
        title="Histórico de Cotações"
        action={
          <Link href="/fretes" className="btn btn-primary">
            Nova cotação
          </Link>
        }
      />

      <form className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
        <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="input" placeholder="De" />
        <input type="date" name="dataFim" defaultValue={params.dataFim} className="input" placeholder="Até" />
        <input type="text" name="cepDestino" defaultValue={params.cepDestino} className="input" placeholder="CEP destino" />
        <select name="status" defaultValue={params.status ?? ""} className="input">
          <option value="">Todos os status</option>
          <option value="sucesso">Sucesso</option>
          <option value="parcial">Parcial</option>
          <option value="erro">Erro</option>
        </select>
        <button type="submit" className="btn btn-outline sm:col-span-4">
          Filtrar
        </button>
      </form>

      {cotacoes.length === 0 ? (
        <p className="state-empty">Nenhuma cotação encontrada.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cotacoes.map((cotacao) => {
            const opcaoSelecionada = cotacao.opcaoSelecionadaJson as { transportadora?: string; servico?: string } | null;
            return (
              <li key={cotacao.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    CEP {cotacao.cepOrigem} → {cotacao.cepDestino}
                    <span className={`badge ${LABEL_STATUS[cotacao.status] ?? "badge"} ml-2`}>{cotacao.status}</span>
                  </p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {cotacao.createdAt.toLocaleString("pt-BR")} · {cotacao.usuario.nome} · {cotacao.pesoKg} kg · {cotacao.alturaCm}×
                    {cotacao.larguraCm}×{cotacao.comprimentoCm} cm
                  </p>
                  {opcaoSelecionada?.transportadora && (
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      Selecionada: {opcaoSelecionada.transportadora} — {opcaoSelecionada.servico}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    {cotacao.menorPrecoCentavos !== null && <p className="font-semibold">a partir de {centavosParaReais(cotacao.menorPrecoCentavos)}</p>}
                    {cotacao.quantidadeOpcoes > 0 && (
                      <p className="text-sm" style={{ color: "var(--muted)" }}>
                        {cotacao.quantidadeOpcoes} opção(ões)
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/fretes?cepOrigem=${cotacao.cepOrigem}&cepDestino=${cotacao.cepDestino}&pesoKg=${cotacao.pesoKg}&alturaCm=${cotacao.alturaCm}&larguraCm=${cotacao.larguraCm}&comprimentoCm=${cotacao.comprimentoCm}`}
                    className="btn btn-outline"
                  >
                    Repetir cotação
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPaginas > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((numero) => (
            <Link
              key={numero}
              href={paginaHref(numero)}
              className={`btn ${numero === pagina ? "btn-primary" : "btn-outline"}`}
            >
              {numero}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
