import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { faturamentoPorPeriodo } from "@/lib/relatorios";
import { vendasRecentes } from "@/lib/dashboard";
import { resumirVenda } from "@/lib/vendas";
import { podeVerVendasCanceladas } from "@/lib/permissoes";
import { centavosParaReais } from "@/lib/money";
import { IconVender } from "@/components/icons";

export default async function VendasVisaoGeralPage() {
  const usuario = await requireLeitura("vendas");
  const [faturamentoDia, faturamentoMes, recentes] = await Promise.all([
    faturamentoPorPeriodo("dia"),
    faturamentoPorPeriodo("mes"),
    // Vendedor não vê venda cancelada nem na lista de recentes.
    vendasRecentes(10, !podeVerVendasCanceladas(usuario.papel)),
  ]);

  return (
    <AppShell usuario={usuario}>
      <PageHeader
        title="Vendas"
        action={
          <Link href="/vendas/nova" className="btn btn-primary">
            <IconVender />
            Nova venda
          </Link>
        }
      />

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="label-caps mb-1">Faturamento hoje</p>
          <p className="text-xl font-bold">{centavosParaReais(faturamentoDia.totalCentavos)}</p>
        </div>
        <div className="card p-4">
          <p className="label-caps mb-1">Vendas hoje</p>
          <p className="text-xl font-bold">{faturamentoDia.quantidadeVendas}</p>
        </div>
        <div className="card p-4">
          <p className="label-caps mb-1">Faturamento no mês</p>
          <p className="text-xl font-bold">{centavosParaReais(faturamentoMes.totalCentavos)}</p>
        </div>
        <div className="card p-4">
          <p className="label-caps mb-1">Vendas no mês</p>
          <p className="text-xl font-bold">{faturamentoMes.quantidadeVendas}</p>
        </div>
      </section>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="label-caps">Vendas recentes</h2>
        <Link href="/vendas/historico" className="label-caps" style={{ color: "var(--accent)" }}>
          Ver histórico completo →
        </Link>
      </div>

      {recentes.length === 0 ? (
        <p className="state-empty">Nenhuma venda registrada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recentes.map((venda) => (
            <li key={venda.id}>
              <Link href={`/vendas/${venda.id}`} className="card card-interactive flex items-center justify-between gap-4 p-4">
                <span className="min-w-0">
                  <span className="font-medium">{venda.cliente?.nome ?? "Cliente não identificado"}</span>{" "}
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    · {venda.dataHora.toLocaleString("pt-BR")}
                  </span>
                  {/* O que foi vendido, sem precisar abrir a venda. */}
                  <span className="venda-itens">{resumirVenda(venda).join(" · ")}</span>
                </span>
                <span className="shrink-0 font-semibold">{centavosParaReais(venda.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
