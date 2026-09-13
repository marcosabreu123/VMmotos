import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { podeVerCustos } from "@/lib/permissoes";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { IconAlerta } from "@/components/icons";
import { faturamentoPorPeriodo, maisVendidos } from "@/lib/relatorios";
import { clientesQueMaisCompraram } from "@/lib/dashboard";
import { produtosSemEstoque, produtosAbaixoDoMinimo, lotesValidadeProxima } from "@/lib/estoque";
import { centavosParaReais } from "@/lib/money";

export default async function RelatoriosPage() {
  const usuario = await requireLeitura("relatorios");
  const podeVerLucro = podeVerCustos(usuario.papel);

  const [faturamentoDia, faturamentoSemana, faturamentoMes, produtosMaisVendidos, clientesTop, semEstoque, abaixoDoMinimo, validadeProxima] =
    await Promise.all([
      faturamentoPorPeriodo("dia"),
      faturamentoPorPeriodo("semana"),
      faturamentoPorPeriodo("mes"),
      maisVendidos(10),
      clientesQueMaisCompraram("mes", 10),
      produtosSemEstoque(),
      produtosAbaixoDoMinimo(),
      lotesValidadeProxima(60),
    ]);

  // "Abaixo do mínimo" já inclui os sem estoque — aqui só quem tem alguma unidade e ainda assim está baixo.
  const estoqueBaixo = abaixoDoMinimo.filter(({ estoqueAtual }) => estoqueAtual > 0);
  const totalAlertas = semEstoque.length + estoqueBaixo.length + validadeProxima.length;

  const cartoes = [
    { titulo: "Hoje", dados: faturamentoDia },
    { titulo: "Esta semana", dados: faturamentoSemana },
    { titulo: "Este mês", dados: faturamentoMes },
  ];

  return (
    <AppShell usuario={usuario}>
        <PageHeader
          title="Relatórios"
          action={
            podeVerLucro ? (
              <div className="flex flex-wrap gap-2">
                <Link href="/relatorios/lucro" className="btn btn-outline">
                  Relatório de lucro
                </Link>
                <Link href="/relatorios/despesas" className="btn btn-outline">
                  Relatório de despesas
                </Link>
                <Link href="/relatorios/clientes" className="btn btn-outline">
                  Relatórios de clientes
                </Link>
              </div>
            ) : undefined
          }
        />

        {totalAlertas > 0 && (
          <section className="mb-8">
            <h2 className="label-caps mb-3 flex items-center gap-2">
              <IconAlerta /> Alertas
            </h2>
            <div className="flex flex-col gap-2">
              {semEstoque.length > 0 && (
                <Link href="/produtos?filtro=sem-estoque" className="card card-interactive flex items-center justify-between p-4">
                  <span>Produtos sem estoque</span>
                  <span className="badge badge-danger">{semEstoque.length}</span>
                </Link>
              )}
              {estoqueBaixo.length > 0 && (
                <Link href="/produtos?filtro=estoque-baixo" className="card card-interactive flex items-center justify-between p-4">
                  <span>Produtos com estoque baixo</span>
                  <span className="badge badge-danger">{estoqueBaixo.length}</span>
                </Link>
              )}
              {validadeProxima.length > 0 && (
                <div className="card p-4">
                  <p className="mb-2 font-medium">Lotes com validade próxima</p>
                  <ul className="flex flex-col gap-1">
                    {validadeProxima.slice(0, 5).map((lote) => (
                      <li key={lote.id} className="flex items-center justify-between text-sm">
                        <Link href={`/produtos/${lote.produtoId}`} style={{ color: "var(--foreground)" }}>
                          {lote.produto.nome} · lote {lote.numero}
                        </Link>
                        <span style={{ color: "var(--muted)" }}>{lote.dataValidade?.toLocaleDateString("pt-BR")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cartoes.map((cartao) => (
            <div key={cartao.titulo} className="card p-5">
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {cartao.titulo}
              </p>
              <p className="mt-1 text-2xl font-bold" style={{ color: "var(--primary)" }}>
                {centavosParaReais(cartao.dados.totalCentavos)}
              </p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {cartao.dados.quantidadeVendas} venda(s)
              </p>
            </div>
          ))}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Produtos mais vendidos</h2>
          {produtosMaisVendidos.length === 0 ? (
            <p className="state-empty">Ainda não há vendas registradas.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {produtosMaisVendidos.map((linha, indice) => (
                <li key={linha.produto?.id ?? indice} className="card flex items-center justify-between p-4">
                  <span className="font-medium">{linha.produto?.nome ?? "Produto removido"}</span>
                  <span className="flex items-center gap-4">
                    <span style={{ color: "var(--muted)" }}>{linha.quantidadeVendida} un.</span>
                    <span className="font-semibold">{centavosParaReais(linha.receitaCentavos)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Clientes que mais compraram (mês)</h2>
          {clientesTop.length === 0 ? (
            <p className="state-empty">Ainda não há vendas registradas neste mês.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {clientesTop.map((linha, indice) => (
                <li key={linha.cliente?.id ?? indice} className="card flex items-center justify-between p-4">
                  <span className="font-medium">{linha.cliente?.nome ?? "Cliente não identificado"}</span>
                  <span className="flex items-center gap-4">
                    <span style={{ color: "var(--muted)" }}>{linha.quantidadeCompras} compra(s)</span>
                    <span className="font-semibold">{centavosParaReais(linha.totalGastoCentavos)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
    </AppShell>
  );
}
