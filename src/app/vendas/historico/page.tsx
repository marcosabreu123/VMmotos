import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarVendas, type FiltrosVendas } from "@/lib/vendas";
import { listarUsuarios } from "@/lib/usuarios";
import { inicioDoPeriodo } from "@/lib/relatorios";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";
import type { FormaPagamento, StatusVenda } from "@prisma/client";

const LABEL_STATUS: Record<StatusVenda, string> = {
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
  DEVOLVIDA_PARCIAL: "Devolvida (parcial)",
  DEVOLVIDA_TOTAL: "Devolvida (total)",
};

const LABEL_PAGAMENTO: Record<FormaPagamento, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  CARTAO_DEBITO: "Débito",
  CARTAO_CREDITO: "Crédito",
};

function badgeStatusClass(status: StatusVenda): string {
  if (status === "CANCELADA") return "badge-danger";
  if (status === "CONCLUIDA") return "badge-success";
  return "badge";
}

type SearchParams = {
  busca?: string;
  status?: string;
  formaPagamento?: string;
  usuarioId?: string;
  dataInicio?: string;
  dataFim?: string;
  valorMinimo?: string;
  valorMaximo?: string;
  comDesconto?: string;
  periodo?: string;
  pagina?: string;
};

export default async function HistoricoVendasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const usuario = await requireLeitura("vendas");
  const params = await searchParams;

  const filtros: FiltrosVendas = {
    busca: params.busca,
    status: (params.status as StatusVenda) || undefined,
    formaPagamento: (params.formaPagamento as FormaPagamento) || undefined,
    usuarioId: params.usuarioId || undefined,
    dataInicio: params.dataInicio
      ? new Date(params.dataInicio)
      : params.periodo === "dia" || params.periodo === "mes"
        ? inicioDoPeriodo(params.periodo)
        : undefined,
    dataFim: params.dataFim ? new Date(`${params.dataFim}T23:59:59`) : undefined,
    valorMinimo: params.valorMinimo ? reaisParaCentavos(params.valorMinimo) : undefined,
    valorMaximo: params.valorMaximo ? reaisParaCentavos(params.valorMaximo) : undefined,
    comDesconto: params.comDesconto === "1",
    pagina: params.pagina ? Number(params.pagina) : 1,
    porPagina: 20,
  };

  const [{ vendas, total, pagina, totalPaginas }, vendedores] = await Promise.all([
    listarVendas(filtros),
    listarUsuarios(),
  ]);

  function paginaHref(numero: number) {
    const query = new URLSearchParams();
    for (const [chave, valor] of Object.entries(params)) {
      if (valor && chave !== "pagina") query.set(chave, valor);
    }
    query.set("pagina", String(numero));
    return `/vendas/historico?${query.toString()}`;
  }

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader title="Histórico de vendas" />

      <form className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        <input
          name="busca"
          defaultValue={params.busca}
          placeholder="Nº da venda, cliente, telefone ou produto..."
          className="input sm:col-span-2"
        />
        <select name="status" defaultValue={params.status ?? ""} className="input">
          <option value="">Todos os status</option>
          {Object.entries(LABEL_STATUS).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <select name="formaPagamento" defaultValue={params.formaPagamento ?? ""} className="input">
          <option value="">Todas as formas de pagamento</option>
          {Object.entries(LABEL_PAGAMENTO).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <select name="usuarioId" defaultValue={params.usuarioId ?? ""} className="input">
          <option value="">Todos os vendedores</option>
          {vendedores.map((vendedor) => (
            <option key={vendedor.id} value={vendedor.id}>
              {vendedor.nome}
            </option>
          ))}
        </select>
        <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="input" />
        <input type="date" name="dataFim" defaultValue={params.dataFim} className="input" />
        <input name="valorMinimo" defaultValue={params.valorMinimo} placeholder="Valor mínimo (R$)" className="input" inputMode="decimal" />
        <input name="valorMaximo" defaultValue={params.valorMaximo} placeholder="Valor máximo (R$)" className="input" inputMode="decimal" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="comDesconto" value="1" defaultChecked={params.comDesconto === "1"} />
          Somente vendas com desconto
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
          <Link href="/vendas/historico" className="btn btn-outline">
            Limpar
          </Link>
        </div>
      </form>

      <p className="label-caps mb-3">{total} venda(s) encontrada(s)</p>

      {vendas.length === 0 ? (
        <p className="state-empty">Nenhuma venda encontrada com esses filtros.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {vendas.map((venda) => (
            <Link
              key={venda.id}
              href={`/vendas/${venda.id}`}
              className="card card-interactive flex flex-wrap items-center gap-3 p-4"
            >
              <span className="label-caps w-24" style={{ color: "var(--muted)" }}>
                #{venda.id.slice(0, 8).toUpperCase()}
              </span>
              <span className="w-40 text-sm" style={{ color: "var(--muted)" }}>
                {venda.dataHora.toLocaleString("pt-BR")}
              </span>
              <span className="flex-1 font-medium">{venda.cliente?.nome ?? "Sem cliente"}</span>
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {venda.usuario.nome}
              </span>
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {venda.itens.length} item(ns)
              </span>
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {LABEL_PAGAMENTO[venda.formaPagamento]}
              </span>
              <span className={`badge ${badgeStatusClass(venda.status)}`}>{LABEL_STATUS[venda.status]}</span>
              <span className="w-28 text-right font-semibold">{centavosParaReais(venda.total)}</span>
            </Link>
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: totalPaginas }, (_, indice) => indice + 1).map((numero) => (
            <Link
              key={numero}
              href={paginaHref(numero)}
              className={`chip ${numero === pagina ? "chip-selected" : ""}`}
            >
              {numero}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
