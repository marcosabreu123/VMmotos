import { notFound } from "next/navigation";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buscarVendaPorId } from "@/lib/vendas";
import { LABEL_TIPO_MOVIMENTACAO } from "@/lib/estoque";
import { centavosParaReais } from "@/lib/money";
import { montarLinkWhatsAppResumoVenda } from "@/lib/whatsapp";
import { listarInsumos, listarUsosPorVenda } from "@/lib/insumos";
import { podeVerCustos, podeVerVendasCanceladas } from "@/lib/permissoes";
import { VendaAcoes } from "./VendaAcoes";
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

export default async function VendaDetalhePage({
  params,
}: {
  params: Promise<{ vendaId: string }>;
}) {
  const usuario = await requireLeitura("vendas");
  const { vendaId } = await params;

  const venda = await buscarVendaPorId(vendaId);
  if (!venda) notFound();

  // Esconder a venda cancelada da lista não basta: sem isto, o endereço
  // direto continuaria abrindo a venda que o vendedor não deveria ver.
  if (venda.status === "CANCELADA" && !podeVerVendasCanceladas(usuario.papel)) {
    notFound();
  }

  const [insumosAtivos, usosInsumo] = await Promise.all([listarInsumos(), listarUsosPorVenda(vendaId)]);
  const podeVerCusto = podeVerCustos(usuario.papel);
  const saldoDevedor = Math.max(0, venda.total - venda.valorPago);

  const itensParaDevolucao = venda.itens.map((item) => ({
    id: item.id,
    produtoNome: item.produto.nome,
    quantidade: item.quantidade,
    jaDevolvido: item.itensDevolvidos.reduce((soma, devolvido) => soma + devolvido.quantidade, 0),
  }));

  const linkWhatsApp = montarLinkWhatsAppResumoVenda(
    venda.cliente?.telefone ?? null,
    venda.cliente?.nome ?? null,
    venda.itens.map((item) => ({ nome: item.produto.nome, quantidade: item.quantidade })),
    venda.total
  );

  return (
    <AppShell usuario={usuario}>
      <PageHeader title={`Venda #${venda.id.slice(0, 8).toUpperCase()}`} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className={`badge ${badgeStatusClass(venda.status)}`}>{LABEL_STATUS[venda.status]}</span>
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          {venda.dataHora.toLocaleString("pt-BR")}
        </span>
      </div>

      <section className="card mb-6 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="label-caps mb-1">Cliente</p>
          <p>{venda.cliente?.nome ?? "Sem cliente identificado"}</p>
          {venda.cliente?.telefone && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {venda.cliente.telefone}
            </p>
          )}
        </div>
        <div>
          <p className="label-caps mb-1">Vendedor</p>
          <p>{venda.usuario.nome}</p>
        </div>
        <div>
          <p className="label-caps mb-1">Forma de pagamento</p>
          <p>{LABEL_PAGAMENTO[venda.formaPagamento]}</p>
        </div>
        {venda.status === "CANCELADA" && (
          <div>
            <p className="label-caps mb-1">Cancelamento</p>
            <p>{venda.motivoCancelamento}</p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {venda.canceladoPor?.nome} · {venda.canceladoEm?.toLocaleString("pt-BR")}
            </p>
          </div>
        )}
        {venda.observacoes && (
          <div className="sm:col-span-2">
            <p className="label-caps mb-1">Observações</p>
            <p>{venda.observacoes}</p>
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="label-caps mb-3">Itens vendidos</h2>
        <ul className="flex flex-col gap-2">
          {venda.itens.map((item) => {
            const devolvido = item.itensDevolvidos.reduce((soma, d) => soma + d.quantidade, 0);
            return (
              <li key={item.id} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{item.produto.nome}</p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {item.quantidade}x {centavosParaReais(item.precoUnitario)}
                    {item.descontoItem > 0 && ` · desconto ${centavosParaReais(item.descontoItem)}`}
                    {devolvido > 0 && ` · ${devolvido} devolvido(s)`}
                  </p>
                </div>
                <span className="font-semibold">{centavosParaReais(item.subtotalItem)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card mb-6 flex flex-col gap-1 p-5">
        <div className="resumo-linha">
          <span>Subtotal</span>
          <span>{centavosParaReais(venda.subtotal)}</span>
        </div>
        <div className="resumo-linha">
          <span>Desconto</span>
          <span>-{centavosParaReais(venda.descontoTotal)}</span>
        </div>
        {venda.acrescimoTotal > 0 && (
          <div className="resumo-linha">
            <span>Acréscimo</span>
            <span>+{centavosParaReais(venda.acrescimoTotal)}</span>
          </div>
        )}
        <div className="resumo-total">
          <span className="label-caps">Total</span>
          <span className="resumo-total-valor">{centavosParaReais(venda.total)}</span>
        </div>
        {saldoDevedor > 0 && (
          <>
            <div className="resumo-linha mt-2">
              <span>Valor pago</span>
              <span>{centavosParaReais(venda.valorPago)}</span>
            </div>
            <div className="resumo-linha">
              <span className="font-semibold" style={{ color: "var(--danger)" }}>
                Saldo devedor
              </span>
              <span className="font-semibold" style={{ color: "var(--danger)" }}>
                {centavosParaReais(saldoDevedor)}
              </span>
            </div>
          </>
        )}
      </section>

      <section className="mb-6 no-print">
        <h2 className="label-caps mb-3">Ações</h2>
        <VendaAcoes
          vendaId={venda.id}
          status={venda.status}
          observacoesAtuais={venda.observacoes ?? ""}
          itensParaDevolucao={itensParaDevolucao}
          linkWhatsApp={linkWhatsApp}
          insumosDisponiveis={insumosAtivos.map((i) => ({ id: i.id, nome: i.nome, unidade: i.unidade }))}
          saldoDevedor={saldoDevedor}
        />
      </section>

      {usosInsumo.length > 0 && (
        <section className="mb-6">
          <h2 className="label-caps mb-3">Insumos usados nesta venda</h2>
          <ul className="flex flex-col gap-2">
            {usosInsumo.map((uso) => (
              <li key={uso.id} className="card flex items-center justify-between p-3 text-sm">
                <span>
                  {uso.quantidade}x {uso.insumo.nome}
                </span>
                {podeVerCusto && <span style={{ color: "var(--muted)" }}>{centavosParaReais(uso.quantidade * uso.custoRealSnapshot)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {venda.devolucoes.length > 0 && (
        <section className="mb-6">
          <h2 className="label-caps mb-3">Devoluções registradas</h2>
          <ul className="flex flex-col gap-2">
            {venda.devolucoes.map((devolucao) => (
              <li key={devolucao.id} className="card p-4">
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {devolucao.createdAt.toLocaleString("pt-BR")} · {devolucao.usuario.nome} · {devolucao.motivo}
                </p>
                <ul className="mt-2 text-sm">
                  {devolucao.itens.map((item) => (
                    <li key={item.id}>
                      {item.quantidade}x {item.itemVenda.produto.nome}
                      {item.retornaEstoque ? " (retornou ao estoque)" : " (não retornou ao estoque)"}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="label-caps mb-3">Movimentações de estoque geradas</h2>
        {venda.movimentacoes.length === 0 ? (
          <p className="state-empty">Nenhuma movimentação registrada.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {venda.movimentacoes.map((mov) => (
              <li key={mov.id} className="card flex items-center justify-between p-3 text-sm">
                <span>
                  {LABEL_TIPO_MOVIMENTACAO[mov.tipo]} · {mov.produto.nome}
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
