import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buscarClientePorId } from "@/lib/clientes";
import { indicadoresDoCliente, segmentosDoCliente } from "@/lib/clientes-relatorio";
import { montarLinkWhatsApp } from "@/lib/whatsapp";
import { centavosParaReais } from "@/lib/money";
import { BotaoAlternarAtivo } from "@/components/BotaoAlternarAtivo";
import { alterarAtivoClienteAction } from "../actions";
import { ClienteObservacao } from "./ClienteObservacao";

export default async function ClienteDetalhePage({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const usuario = await requireLeitura("clientes");
  const { clienteId } = await params;

  const cliente = await buscarClientePorId(clienteId);
  if (!cliente) notFound();

  const [indicadores, segmentos] = await Promise.all([indicadoresDoCliente(clienteId), segmentosDoCliente(clienteId)]);

  const ultimaVendaId = cliente.vendas[0]?.id;
  const saldoDevedorTotal = cliente.vendas
    .filter((venda) => venda.status !== "CANCELADA")
    .reduce((soma, venda) => soma + Math.max(0, venda.total - venda.valorPago), 0);
  const linkWhatsApp = montarLinkWhatsApp(cliente.telefone, `Olá${cliente.nome ? " " + cliente.nome : ""}! Tudo bem?`);

  return (
    <AppShell usuario={usuario}>
      <PageHeader
        title={cliente.nome}
        action={
          <BotaoAlternarAtivo
            ativo={cliente.ativo}
            acao={alterarAtivoClienteAction.bind(null, cliente.id, !cliente.ativo)}
          />
        }
      />
      {!cliente.ativo && <p className="badge badge-danger mb-3 w-fit">Cliente arquivado</p>}
      <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>
        {[cliente.telefone, cliente.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
      </p>

      {segmentos.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {segmentos.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/vendas/nova" className="btn btn-primary">
          Nova venda
        </Link>
        {ultimaVendaId && (
          <Link href={`/vendas/nova?duplicar=${ultimaVendaId}`} className="btn btn-outline">
            Duplicar última venda
          </Link>
        )}
        {linkWhatsApp && (
          <a href={linkWhatsApp} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
            Abrir WhatsApp
          </a>
        )}
        <a href={`/api/clientes/${cliente.id}/exportar`} className="btn btn-outline">
          Exportar histórico
        </a>
      </div>

      {saldoDevedorTotal > 0 && (
        <div className="card mb-6 p-4" style={{ borderColor: "var(--danger)" }}>
          <p className="label-caps mb-1" style={{ color: "var(--danger)" }}>
            Saldo devedor
          </p>
          <p className="text-xl font-bold" style={{ color: "var(--danger)" }}>
            {centavosParaReais(saldoDevedorTotal)}
          </p>
        </div>
      )}

      {indicadores.numeroCompras > 0 && (
        <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card p-4">
            <p className="label-caps mb-1">Total gasto</p>
            <p className="text-lg font-bold">{centavosParaReais(indicadores.totalGastoCentavos)}</p>
          </div>
          <div className="card p-4">
            <p className="label-caps mb-1">Nº de compras</p>
            <p className="text-lg font-bold">{indicadores.numeroCompras}</p>
          </div>
          <div className="card p-4">
            <p className="label-caps mb-1">Ticket médio</p>
            <p className="text-lg font-bold">{centavosParaReais(indicadores.ticketMedioCentavos)}</p>
          </div>
          <div className="card p-4">
            <p className="label-caps mb-1">Dias desde última compra</p>
            <p className="text-lg font-bold">{indicadores.diasDesdeUltimaCompra}</p>
          </div>
          <div className="card p-4">
            <p className="label-caps mb-1">Primeira compra</p>
            <p className="text-sm">{indicadores.primeiraCompra?.toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="card p-4">
            <p className="label-caps mb-1">Produto favorito</p>
            <p className="text-sm">{indicadores.produtoFavorito ?? "—"}</p>
          </div>
          <div className="card p-4">
            <p className="label-caps mb-1">Marca preferida</p>
            <p className="text-sm">{indicadores.marcaPreferida ?? "—"}</p>
          </div>
          <div className="card p-4">
            <p className="label-caps mb-1">Categoria preferida</p>
            <p className="text-sm">{indicadores.categoriaPreferida ?? "—"}</p>
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="label-caps mb-3">Observações</h2>
        <ClienteObservacao clienteId={cliente.id} observacoesAtuais={cliente.observacoes ?? ""} />
      </section>

      <h2 className="label-caps mb-3">Histórico de compras</h2>
      {cliente.vendas.length === 0 ? (
        <p className="state-empty">Nenhuma compra registrada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cliente.vendas.map((venda) => {
            const saldoVenda = venda.status !== "CANCELADA" ? Math.max(0, venda.total - venda.valorPago) : 0;
            return (
              <li key={venda.id}>
                <Link href={`/vendas/${venda.id}`} className="card card-interactive block p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm" style={{ color: "var(--muted)" }}>
                      {venda.dataHora.toLocaleString("pt-BR")}
                      {venda.status === "CANCELADA" && <span className="badge badge-danger ml-2">Cancelada</span>}
                      {venda.status === "DEVOLVIDA_PARCIAL" && <span className="badge badge-danger ml-2">Devolvida (parcial)</span>}
                      {venda.status === "DEVOLVIDA_TOTAL" && <span className="badge badge-danger ml-2">Devolvida (total)</span>}
                      {saldoVenda > 0 && <span className="badge badge-danger ml-2">Em débito</span>}
                    </span>
                    <span className="font-semibold">{centavosParaReais(venda.total)}</span>
                  </div>
                  <ul className="text-sm" style={{ color: "var(--muted)" }}>
                    {venda.itens.map((item) => (
                      <li key={item.id}>
                        {item.quantidade}x {item.produto.nome}
                      </li>
                    ))}
                  </ul>
                  {saldoVenda > 0 && (
                    <p className="mt-2 text-sm font-medium" style={{ color: "var(--danger)" }}>
                      Saldo devedor: {centavosParaReais(saldoVenda)}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
