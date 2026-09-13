import { notFound } from "next/navigation";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buscarPedidoPorId } from "@/lib/compras";
import { LABEL_TIPO_MOVIMENTACAO } from "@/lib/estoque";
import { centavosParaReais } from "@/lib/money";
import { PedidoAcoes } from "./PedidoAcoes";
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

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ pedidoId: string }>;
}) {
  const usuario = await requireLeitura("compras");
  const { pedidoId } = await params;

  const pedido = await buscarPedidoPorId(pedidoId);
  if (!pedido) notFound();

  const totalItens = pedido.itens.reduce((soma, item) => soma + item.custoUnitario * (item.quantidade + item.quantidadeDemonstracao), 0);
  const totalPedido = totalItens + pedido.valorFrete;

  const itensParaAcoes = pedido.itens.map((item) => ({ id: item.id, produtoNome: item.produto.nome }));

  return (
    <AppShell usuario={usuario}>
      <PageHeader title={`Pedido #${pedido.id.slice(0, 8).toUpperCase()}`} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className={`badge ${badgeStatusClass(pedido.status)}`}>{LABEL_STATUS[pedido.status]}</span>
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          Pedido em {pedido.dataPedido.toLocaleString("pt-BR")}
        </span>
        {pedido.dataRecebimento && (
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            · Recebido em {pedido.dataRecebimento.toLocaleString("pt-BR")}
          </span>
        )}
      </div>

      <section className="card mb-6 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="label-caps mb-1">Fornecedor</p>
          <p>{pedido.fornecedor.nome}</p>
          {pedido.fornecedor.telefone && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {pedido.fornecedor.telefone}
            </p>
          )}
        </div>
        <div>
          <p className="label-caps mb-1">Frete</p>
          <p>{centavosParaReais(pedido.valorFrete)}</p>
        </div>
        {pedido.observacoes && (
          <div className="sm:col-span-2">
            <p className="label-caps mb-1">Observações</p>
            <p>{pedido.observacoes}</p>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="label-caps mb-3">Itens do pedido</h2>
        <ul className="flex flex-col gap-2">
          {pedido.itens.map((item) => (
            <li key={item.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{item.produto.nome}</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {item.quantidade} un.
                  {item.quantidadeDemonstracao > 0 && ` + ${item.quantidadeDemonstracao} demonstracao`} ·{" "}
                  {centavosParaReais(item.custoUnitario)}/un.
                  {item.lote && (
                    <>
                      {" "}
                      · lote {item.lote.numero} · custo real {centavosParaReais(item.lote.custoReal)}
                      {item.lote.freteRateado > 0 && ` (frete rateado ${centavosParaReais(item.lote.freteRateado)})`}
                      {item.lote.dataValidade && ` · validade ${item.lote.dataValidade.toLocaleDateString("pt-BR")}`}
                    </>
                  )}
                </p>
              </div>
              <span className="font-semibold">
                {centavosParaReais(item.custoUnitario * (item.quantidade + item.quantidadeDemonstracao))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mb-6 flex flex-col gap-1 p-5">
        <div className="resumo-linha">
          <span>Subtotal dos itens</span>
          <span>{centavosParaReais(totalItens)}</span>
        </div>
        <div className="resumo-linha">
          <span>Frete</span>
          <span>{centavosParaReais(pedido.valorFrete)}</span>
        </div>
        <div className="resumo-total">
          <span className="label-caps">Total</span>
          <span className="resumo-total-valor">{centavosParaReais(totalPedido)}</span>
        </div>
      </section>

      <section className="mb-6 no-print">
        <h2 className="label-caps mb-3">Ações</h2>
        <PedidoAcoes pedidoId={pedido.id} status={pedido.status} itens={itensParaAcoes} />
      </section>

      <section>
        <h2 className="label-caps mb-3">Movimentações de estoque geradas</h2>
        {pedido.movimentacoes.length === 0 ? (
          <p className="state-empty">Nenhuma movimentação registrada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pedido.movimentacoes.map((mov) => (
              <li key={mov.id} className="card flex items-center justify-between p-3 text-sm">
                <span>
                  {LABEL_TIPO_MOVIMENTACAO[mov.tipo]} · {mov.pool === "DEMONSTRACAO" ? "demonstracao" : "venda"}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {mov.quantidade} un. · {mov.createdAt.toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
