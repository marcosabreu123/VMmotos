import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarAuditoria, listarAcoesDistintas, type FiltrosAuditoria } from "@/lib/auditoria";
import { listarUsuarios } from "@/lib/usuarios";
import { centavosParaReais } from "@/lib/money";

type SearchParams = {
  usuarioId?: string;
  acao?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: string;
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const usuarioLogado = await requireOwner();
  const params = await searchParams;

  const filtros: FiltrosAuditoria = {
    usuarioId: params.usuarioId || undefined,
    acao: params.acao || undefined,
    dataInicio: params.dataInicio ? new Date(params.dataInicio) : undefined,
    dataFim: params.dataFim ? new Date(`${params.dataFim}T23:59:59`) : undefined,
    pagina: params.pagina ? Number(params.pagina) : 1,
    porPagina: 30,
  };

  const [{ registros, total, pagina, totalPaginas }, usuarios, acoes] = await Promise.all([
    listarAuditoria(filtros),
    listarUsuarios(),
    listarAcoesDistintas(),
  ]);

  function paginaHref(numero: number) {
    const query = new URLSearchParams();
    for (const [chave, valor] of Object.entries(params)) {
      if (valor && chave !== "pagina") query.set(chave, valor);
    }
    query.set("pagina", String(numero));
    return `/auditoria?${query.toString()}`;
  }

  return (
    <AppShell usuario={usuarioLogado} wide>
      <PageHeader title="Auditoria" />

      <form className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
        <select name="usuarioId" defaultValue={params.usuarioId ?? ""} className="input">
          <option value="">Todos os usuários</option>
          {usuarios.map((usuario) => (
            <option key={usuario.id} value={usuario.id}>
              {usuario.nome}
            </option>
          ))}
        </select>
        <select name="acao" defaultValue={params.acao ?? ""} className="input">
          <option value="">Todas as ações</option>
          {acoes.map((acao) => (
            <option key={acao} value={acao}>
              {acao}
            </option>
          ))}
        </select>
        <input type="date" name="dataInicio" defaultValue={params.dataInicio} className="input" />
        <input type="date" name="dataFim" defaultValue={params.dataFim} className="input" />
        <div className="flex gap-2 sm:col-span-4">
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
          <Link href="/auditoria" className="btn btn-outline">
            Limpar
          </Link>
        </div>
      </form>

      <p className="label-caps mb-3">{total} registro(s) encontrado(s)</p>

      {registros.length === 0 ? (
        <p className="state-empty">Nenhum registro de auditoria encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {registros.map((registro) => (
            <div key={registro.id} className="card flex flex-wrap items-center gap-3 p-4">
              <span className="w-40 text-sm" style={{ color: "var(--muted)" }}>
                {registro.createdAt.toLocaleString("pt-BR")}
              </span>
              <span className="font-medium">{registro.usuario.nome}</span>
              <span className="badge">{registro.acao}</span>
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {registro.entidade}
                {registro.entidadeId && ` #${registro.entidadeId.slice(0, 8).toUpperCase()}`}
              </span>
              {registro.detalhes && (
                <span className="flex-1 text-sm" style={{ color: "var(--muted)" }}>
                  {registro.detalhes}
                </span>
              )}
              {registro.valorAnterior !== null && registro.valorNovo !== null && (
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  {centavosParaReais(registro.valorAnterior)} → {centavosParaReais(registro.valorNovo)}
                </span>
              )}
            </div>
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
