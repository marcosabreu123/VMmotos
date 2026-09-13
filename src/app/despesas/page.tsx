import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarDespesas, statusEfetivoDespesa, type FiltrosDespesas, type StatusEfetivo } from "@/lib/despesas";
import { listarCategoriasDespesa } from "@/lib/despesas";
import { listarUsuarios } from "@/lib/usuarios";
import { centavosParaReais } from "@/lib/money";

type SearchParams = {
  dataInicio?: string;
  dataFim?: string;
  categoriaId?: string;
  status?: StatusEfetivo;
  formaPagamento?: string;
  recorrencia?: string;
  usuarioId?: string;
  valorMinimo?: string;
  valorMaximo?: string;
  busca?: string;
  filtro?: string;
  pagina?: string;
};

const BADGE_STATUS: Record<StatusEfetivo, string> = {
  pendente: "badge",
  pago: "badge-success",
  vencido: "badge-danger",
  cancelado: "badge-danger",
};

const LABEL_STATUS: Record<StatusEfetivo, string> = {
  pendente: "Pendente",
  pago: "Pago",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

export default async function DespesasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const usuario = await requireLeitura("despesas");
  const params = await searchParams;

  const filtros: FiltrosDespesas = {
    dataInicio: params.dataInicio ? new Date(params.dataInicio) : undefined,
    dataFim: params.dataFim ? new Date(`${params.dataFim}T23:59:59`) : undefined,
    categoriaId: params.categoriaId || undefined,
    status: params.status || undefined,
    formaPagamento: (params.formaPagamento as FiltrosDespesas["formaPagamento"]) || undefined,
    recorrencia: (params.recorrencia as FiltrosDespesas["recorrencia"]) || undefined,
    usuarioId: params.usuarioId || undefined,
    valorMinimo: params.valorMinimo ? Math.round(Number(params.valorMinimo) * 100) : undefined,
    valorMaximo: params.valorMaximo ? Math.round(Number(params.valorMaximo) * 100) : undefined,
    busca: params.busca || undefined,
    apenasArquivadas: params.filtro === "arquivadas",
    pagina: params.pagina ? Number(params.pagina) : 1,
    porPagina: 20,
  };

  const [{ despesas, total, pagina, totalPaginas }, categorias, usuarios] = await Promise.all([
    listarDespesas(filtros),
    listarCategoriasDespesa(),
    listarUsuarios(),
  ]);

  function paginaHref(numero: number) {
    const query = new URLSearchParams();
    for (const [chave, valor] of Object.entries(params)) {
      if (valor && chave !== "pagina") query.set(chave, valor);
    }
    query.set("pagina", String(numero));
    return `/despesas?${query.toString()}`;
  }

  const queryAtual = new URLSearchParams(
    Object.entries(params).filter(([, valor]) => Boolean(valor)) as [string, string][]
  ).toString();

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader
        title={params.filtro === "arquivadas" ? "Despesas arquivadas" : "Despesas"}
        action={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/despesas/exportar?${queryAtual}`} className="btn btn-outline">
              Exportar CSV
            </a>
            <Link href="/despesas/categorias" className="btn btn-outline">
              Categorias
            </Link>
            <Link href="/despesas/nova" className="btn btn-primary">
              + Nova despesa
            </Link>
          </div>
        }
      />

      {params.filtro === "arquivadas" ? (
        <Link href="/despesas" className="label-caps mb-4 inline-block" style={{ color: "var(--accent)" }}>
          ← ver todas as despesas
        </Link>
      ) : (
        <Link href="/despesas?filtro=arquivadas" className="label-caps mb-4 inline-block" style={{ color: "var(--muted)" }}>
          Ver arquivadas
        </Link>
      )}

      <form className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
        <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="input" placeholder="De" />
        <input type="date" name="dataFim" defaultValue={params.dataFim} className="input" placeholder="Até" />
        <select name="categoriaId" defaultValue={params.categoriaId ?? ""} className="input">
          <option value="">Todas as categorias</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ""} className="input">
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
          <option value="vencido">Vencido</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select name="formaPagamento" defaultValue={params.formaPagamento ?? ""} className="input">
          <option value="">Toda forma de pagamento</option>
          <option value="DINHEIRO">Dinheiro</option>
          <option value="PIX">PIX</option>
          <option value="CARTAO_DEBITO">Cartão de débito</option>
          <option value="CARTAO_CREDITO">Cartão de crédito</option>
          <option value="BOLETO">Boleto</option>
          <option value="TRANSFERENCIA">Transferência</option>
          <option value="OUTRO">Outro</option>
        </select>
        <select name="recorrencia" defaultValue={params.recorrencia ?? ""} className="input">
          <option value="">Toda recorrência</option>
          <option value="NENHUMA">Nenhuma</option>
          <option value="SEMANAL">Semanal</option>
          <option value="MENSAL">Mensal</option>
          <option value="TRIMESTRAL">Trimestral</option>
          <option value="SEMESTRAL">Semestral</option>
          <option value="ANUAL">Anual</option>
        </select>
        <select name="usuarioId" defaultValue={params.usuarioId ?? ""} className="input">
          <option value="">Todos os usuários</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
        <input name="busca" defaultValue={params.busca} placeholder="Buscar descrição..." className="input" />
        <input type="number" step="0.01" name="valorMinimo" defaultValue={params.valorMinimo} placeholder="Valor mínimo" className="input" />
        <input type="number" step="0.01" name="valorMaximo" defaultValue={params.valorMaximo} placeholder="Valor máximo" className="input" />
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
          <Link href="/despesas" className="btn btn-outline">
            Limpar
          </Link>
        </div>
      </form>

      <p className="label-caps mb-3">{total} despesa(s) encontrada(s)</p>

      {despesas.length === 0 ? (
        <p className="state-empty">Nenhuma despesa encontrada.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {despesas.map((despesa) => {
            const status = statusEfetivoDespesa(despesa);
            return (
              <Link
                key={despesa.id}
                href={`/despesas/${despesa.id}`}
                className="card card-interactive flex flex-wrap items-center gap-3 p-4"
              >
                <span className="flex-1 font-medium">{despesa.descricao}</span>
                <span className="badge">{despesa.categoria.nome}</span>
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  {despesa.dataDespesa.toLocaleDateString("pt-BR")}
                  {despesa.vencimento && ` · vence ${despesa.vencimento.toLocaleDateString("pt-BR")}`}
                </span>
                <span className={`badge ${BADGE_STATUS[status]}`}>{LABEL_STATUS[status]}</span>
                <span className="font-semibold">{centavosParaReais(despesa.valor)}</span>
              </Link>
            );
          })}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: totalPaginas }, (_, indice) => indice + 1).map((numero) => (
            <Link key={numero} href={paginaHref(numero)} className={`chip ${numero === pagina ? "chip-selected" : ""}`}>
              {numero}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
