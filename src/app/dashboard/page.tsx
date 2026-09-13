import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { resumoDashboard } from "@/lib/dashboard";
import { podeVerCustos } from "@/lib/permissoes";
import { centavosParaReais } from "@/lib/money";
import { IconVender, IconProdutos, IconClientes, IconEntradaEstoque } from "@/components/icons";

function StatCard({
  titulo,
  valor,
  href,
}: {
  titulo: string;
  valor: string;
  href?: string;
}) {
  const conteudo = (
    <div className="card p-5">
      <p className="label-caps mb-1">{titulo}</p>
      <p className="text-2xl font-bold">{valor}</p>
    </div>
  );

  return href ? (
    <Link href={href} className="card-interactive block">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}

export default async function DashboardPage() {
  const usuario = await requireUser();
  const dados = await resumoDashboard();
  const podeVerLucro = podeVerCustos(usuario.papel);

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader
        title="Visão geral"
        action={
          <div className="flex flex-wrap gap-2">
            {podeVerLucro && (
              <Link href="/estoque" className="btn btn-outline">
                Ver valor do estoque
              </Link>
            )}
            <Link href="/relatorios" className="btn btn-outline">
              Ver relatórios completos
            </Link>
          </div>
        }
      />

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard titulo="Faturamento hoje" valor={centavosParaReais(dados.faturamentoDia.totalCentavos)} href="/vendas/historico?periodo=dia" />
        <StatCard titulo="Faturamento no mês" valor={centavosParaReais(dados.faturamentoMes.totalCentavos)} href="/vendas/historico?periodo=mes" />
        <StatCard titulo="Vendas hoje" valor={String(dados.faturamentoDia.quantidadeVendas)} href="/vendas/historico?periodo=dia" />
        <StatCard titulo="Vendas no mês" valor={String(dados.faturamentoMes.quantidadeVendas)} href="/vendas/historico?periodo=mes" />
        <StatCard titulo="Ticket médio (mês)" valor={centavosParaReais(dados.ticketMedioMes)} />
      </section>

      <section className="mb-8">
        <h2 className="label-caps mb-3">Atalhos rápidos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/vendas/nova" className="btn btn-primary">
            <IconVender />
            Nova venda
          </Link>
          <Link href="/produtos/novo" className="btn btn-outline">
            <IconProdutos />
            Novo produto
          </Link>
          <Link href="/clientes" className="btn btn-outline">
            <IconClientes />
            Novo cliente
          </Link>
          <Link href="/estoque/entrada-estoque" className="btn btn-outline">
            <IconEntradaEstoque />
            Nova entrada
          </Link>
        </div>
      </section>

      <section>
        <h2 className="label-caps mb-3">Vendas recentes</h2>
        {dados.recentes.length === 0 ? (
          <p className="state-empty">Nenhuma venda registrada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dados.recentes.map((venda) => (
              <li key={venda.id}>
                <Link href={`/vendas/${venda.id}`} className="card card-interactive flex items-center justify-between p-3">
                  <span>
                    <span className="font-medium">{venda.cliente?.nome ?? "Cliente não identificado"}</span>{" "}
                    <span className="text-sm" style={{ color: "var(--muted)" }}>
                      · {venda.itens.length} item(ns) · {venda.dataHora.toLocaleString("pt-BR")}
                    </span>
                  </span>
                  <span className="font-semibold">{centavosParaReais(venda.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
