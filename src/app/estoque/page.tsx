import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EstoqueBadge } from "@/components/EstoqueBadge";
import { listarVisaoEstoque, valorEstoqueAtual } from "@/lib/estoque";
import { podeVerCustos } from "@/lib/permissoes";
import { centavosParaReais } from "@/lib/money";
import { formatQuantidadeEstoque } from "@/lib/unidadeEstoque";

export default async function EstoquePage() {
  const usuario = await requireLeitura("estoque");
  const visaoCustos = podeVerCustos(usuario.papel);

  const [itens, valorEstoque] = await Promise.all([
    listarVisaoEstoque(),
    visaoCustos ? valorEstoqueAtual() : Promise.resolve(null),
  ]);

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader
        title="Estoque"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/estoque/insumos" className="btn btn-outline">
              Insumos
            </Link>
            <Link href="/estoque/ajuste" className="btn btn-outline">
              Ajustar estoque
            </Link>
            <Link href="/estoque/entrada-estoque/historico" className="btn btn-outline">
              Histórico de entradas
            </Link>
            <Link href="/estoque/entrada-estoque" className="btn btn-primary btn-lg">
              + Dar Entrada
            </Link>
          </div>
        }
      />

      {valorEstoque && (
        <section className="card mb-8 p-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label-caps mb-1">Lucro futuro potencial</p>
              <p className="resumo-total-valor">{centavosParaReais(valorEstoque.lucroFuturoPotencial)}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {valorEstoque.margemPotencial.toFixed(1)}% de margem se tudo vender pelo preço cheio
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="label-caps mb-1">Valor em custo</p>
                <p className="text-xl font-semibold">{centavosParaReais(valorEstoque.valorCustoTotal)}</p>
              </div>
              <span style={{ color: "var(--muted)" }}>→</span>
              <div className="text-right">
                <p className="label-caps mb-1">Venda projetada</p>
                <p className="text-xl font-semibold">{centavosParaReais(valorEstoque.valorVendaProjetado)}</p>
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>
            {valorEstoque.produtosComEstoque} produto(s) com estoque · {valorEstoque.unidadesTotais} unidade(s) no total
          </p>
        </section>
      )}

      {itens.length === 0 ? (
        <p className="state-empty">Nenhum produto cadastrado ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {itens.map(({ produto, quantidadeAtual, custoMedio, status }) => (
            <Link
              key={produto.id}
              href={`/produtos/${produto.id}`}
              className="card card-interactive flex flex-wrap items-center gap-4 p-4"
            >
              {produto.fotoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={produto.fotoPath} alt={produto.nome} className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg text-xs"
                  style={{ background: "var(--surface-muted)", color: "var(--muted)" }}
                >
                  sem foto
                </div>
              )}

              <div className="min-w-[10rem] flex-1">
                <p className="font-semibold">{produto.nome}</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {produto.categoria} {produto.fornecedor ? `· ${produto.fornecedor.nome}` : ""}
                </p>
              </div>

              <span className="text-sm" style={{ color: "var(--muted)" }}>
                mín. {formatQuantidadeEstoque(produto.estoqueMinimo, produto.tipoVenda)}
              </span>

              <EstoqueBadge estoqueAtual={quantidadeAtual} estoqueMinimo={produto.estoqueMinimo} tipoVenda={produto.tipoVenda} />

              {visaoCustos && (
                <span className="w-24 text-right text-sm" style={{ color: "var(--muted)" }}>
                  {status === "sem_estoque" ? "—" : `custo ${centavosParaReais(custoMedio)}`}
                </span>
              )}

              <span className="w-24 text-right font-semibold">{centavosParaReais(produto.precoVenda)}</span>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
