import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarPedidos, contarPedidosEmAberto, resumoComprasMes, type FiltrosPedidos } from "@/lib/compras";
import { listarFornecedores } from "@/lib/fornecedores";
import { centavosParaReais } from "@/lib/money";
import type { StatusPedido } from "@prisma/client";

const LABEL_STATUS: Record<StatusPedido, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  RECEBIDO: "Recebido",
  CANCELADO: "Cancelado",
};

function badgeStatusClass(status: StatusPedido): string {
  if (status === "CANCELADO") return "badge-danger";
  if (status === "RECEBIDO") return "badge-success";
  return "badge";
}

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; fornecedorId?: string; pagina?: string }>;
}) {
  const usuario = await requireLeitura("compras");
  const params = await searchParams;

  const filtros: FiltrosPedidos = {
    status: (params.status as StatusPedido) || undefined,
    fornecedorId: params.fornecedorId || undefined,
    pagina: params.pagina ? Number(params.pagina) : 1,
    porPagina: 20,
  };

  const [{ pedidos, total, pagina, totalPaginas }, fornecedores, pedidosEmAberto, resumoMes] = await Promise.all([
    listarPedidos(filtros),
    listarFornecedores(),
    contarPedidosEmAberto(),
    resumoComprasMes(),
  ]);

  function paginaHref(numero: number) {
    const query = new URLSearchParams();
    for (const [chave, valor] of Object.entries(params)) {
      if (valor && chave !== "pagina") query.set(chave, valor);
    }
    query.set("pagina", String(numero));
    return `/compras?${query.toString()}`;
  }

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader
        title="Compras"
        action={
          <Link href="/compras/novo" className="btn btn-primary">
            + Novo pedido
          </Link>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="label-caps mb-1">Pedidos em aberto</p>
          <p className="text-2xl font-bold">{pedidosEmAberto}</p>
        </div>
        <div className="card p-5">
          <p className="label-caps mb-1">Recebidos no mês</p>
          <p className="text-2xl font-bold">{resumoMes.quantidadeRecebidos}</p>
        </div>
        <div className="card p-5">
          <p className="label-caps mb-1">Valor recebido no mês</p>
          <p className="text-2xl font-bold">{centavosParaReais(resumoMes.valorTotal)}</p>
        </div>
      </section>

      <form className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <select name="status" defaultValue={params.status ?? ""} className="input">
          <option value="">Todos os status</option>
          {Object.entries(LABEL_STATUS).map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <select name="fornecedorId" defaultValue={params.fornecedorId ?? ""} className="input">
          <option value="">Todos os fornecedores</option>
          {fornecedores.map((fornecedor) => (
            <option key={fornecedor.id} value={fornecedor.id}>
              {fornecedor.nome}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            Filtrar
          </button>
          <Link href="/compras" className="btn btn-outline">
            Limpar
          </Link>
        </div>
      </form>

      <p className="label-caps mb-3">{total} pedido(s) encontrado(s)</p>

      {pedidos.length === 0 ? (
        <p className="state-empty">Nenhum pedido de compra encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pedidos.map((pedido) => (
            <Link
              key={pedido.id}
              href={`/compras/${pedido.id}`}
              className="card card-interactive flex flex-wrap items-center gap-3 p-4"
            >
              <span className="label-caps w-24" style={{ color: "var(--muted)" }}>
                #{pedido.id.slice(0, 8).toUpperCase()}
              </span>
              <span className="w-40 text-sm" style={{ color: "var(--muted)" }}>
                {pedido.dataPedido.toLocaleString("pt-BR")}
              </span>
              <span className="flex-1 font-medium">{pedido.fornecedor.nome}</span>
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {pedido.itens.length} item(ns)
              </span>
              <span className={`badge ${badgeStatusClass(pedido.status)}`}>{LABEL_STATUS[pedido.status]}</span>
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
