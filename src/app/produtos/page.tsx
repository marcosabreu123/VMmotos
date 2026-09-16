import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EstoqueBadge } from "@/components/EstoqueBadge";
import { estoqueDeVariosProdutos, listarProdutos } from "@/lib/produtos";
import { produtosAbaixoDoMinimo, produtosSemEstoque, valorEstoqueAtual } from "@/lib/estoque";
import { podeVerCustos } from "@/lib/permissoes";
import { centavosParaReais } from "@/lib/money";
import { nicho } from "@/config/nicho";
import { IconEntradaEstoque } from "@/components/icons";

/**
 * PEÇAS — tela única de catálogo + estoque.
 *
 * Antes isso eram quatro telas separadas (produtos, estoque, entrada de
 * estoque, pedido de compra) mostrando a mesma lista com nomes diferentes. O
 * dono pediu para juntar: aqui se vê o que tem, por quanto vende e quanto há
 * em estoque, e daqui se lança a entrada — que é a ação de maior destaque,
 * porque é a que ele mais faz depois de vender.
 */

const TITULOS_FILTRO: Record<string, string> = {
  "estoque-baixo": "Peças com estoque baixo",
  "sem-estoque": "Peças sem estoque",
  arquivados: "Peças arquivadas",
};

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; filtro?: string }>;
}) {
  const usuario = await requireUser();
  const { busca, filtro } = await searchParams;
  const vePrecoDeCusto = podeVerCustos(usuario.papel);

  type ItemLista = {
    produto: {
      id: string;
      nome: string;
      marca: string;
      categoria: string;
      sku: string;
      fotoPath: string | null;
      precoVenda: number;
      estoqueMinimo: number;
      tipoVenda: "UNIDADE" | "FRACIONADO";
    };
    estoqueAtual: number;
  };

  let itens: ItemLista[];

  if (filtro === "sem-estoque") {
    itens = await produtosSemEstoque();
  } else if (filtro === "estoque-baixo") {
    itens = await produtosAbaixoDoMinimo();
  } else {
    const produtos = await listarProdutos(busca, filtro === "arquivados");
    const estoques = await estoqueDeVariosProdutos(produtos.map((p) => p.id));
    itens = produtos.map((produto) => ({ produto, estoqueAtual: estoques.get(produto.id) ?? 0 }));
  }

  const valorEstoque = vePrecoDeCusto && !filtro ? await valorEstoqueAtual() : null;

  const plural = nicho.termos.produto.plural;

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader title={filtro ? (TITULOS_FILTRO[filtro] ?? plural) : plural} />

      {/* Lançar pedido é a ação principal desta tela e por isso vem antes de
          tudo, em tamanho grande: é o que o dono faz toda vez que chega
          mercadoria, e antes estava escondido numa tela separada. */}
      <div className="acoes-pecas">
        <Link href="/estoque/entrada-estoque" className="btn btn-primary btn-lg acao-destaque">
          <IconEntradaEstoque width={22} height={22} />
          Lançar pedido
        </Link>
        <Link href="/produtos/novo" className="btn btn-outline">
          + Nova peça
        </Link>
        {/* Sobe de link de texto para botão: tirar peça do estoque (quebrou,
            sumiu, foi de brinde) é rotina, e como link discreto passava
            despercebido — a impressão era de que a função não existia. */}
        <Link href="/estoque/ajuste" className="btn btn-outline">
          − Dar baixa
        </Link>
        {vePrecoDeCusto && (
          <Link href="/produtos/precos" className="btn btn-outline">
            Preços e margem
          </Link>
        )}
      </div>

      {valorEstoque && (
        <section className="card mb-6 p-5">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label-caps mb-1">Lucro futuro potencial</p>
              <p className="resumo-valor">{centavosParaReais(valorEstoque.lucroFuturoPotencial)}</p>
              <p className="ajuda">
                {valorEstoque.margemPotencial.toFixed(1)}% de margem se tudo vender pelo preço cheio
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Ferramentas de estoque: usadas de vez em quando, então ficam
          discretas, sem competir com "Lançar pedido". */}
      <div className="acoes-secundarias">
        <Link href="/estoque/inventario">Conferir estoque</Link>
        <Link href="/estoque/lotes">Lotes</Link>
        <Link href="/estoque/insumos">Insumos</Link>
        <Link href="/estoque/entrada-estoque/historico">Histórico de entradas</Link>
        <Link href="/produtos?filtro=estoque-baixo">Estoque baixo</Link>
        <Link href="/produtos?filtro=sem-estoque">Sem estoque</Link>
        <Link href="/ferramentas/importar">Importar CSV</Link>
        <a href="/api/produtos/exportar">Exportar CSV</a>
      </div>

      {filtro && (
        <Link href="/produtos" className="label-caps mb-4 inline-block" style={{ color: "var(--accent)" }}>
          ← ver todas as {plural.toLowerCase()}
        </Link>
      )}

      {!filtro && (
        <>
          <form className="mb-3">
            <input
              name="busca"
              defaultValue={busca}
              placeholder="Buscar por nome, fabricante, código ou código de barras..."
              className="input"
            />
          </form>
          <Link
            href="/produtos?filtro=arquivados"
            className="label-caps mb-6 inline-block"
            style={{ color: "var(--muted)" }}
          >
            Ver arquivadas
          </Link>
        </>
      )}

      {itens.length === 0 ? (
        <p className="state-empty">Nenhuma peça encontrada.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {itens.map(({ produto, estoqueAtual }) => (
            <li key={produto.id}>
              <Link href={`/produtos/${produto.id}`} className="card card-interactive flex items-center gap-4 p-4">
                {produto.fotoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={produto.fotoPath} alt={produto.nome} className="h-14 w-14 rounded-lg object-cover" />
                ) : (
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-lg text-xs"
                    style={{ background: "var(--surface-muted)", color: "var(--muted)" }}
                  >
                    sem foto
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold">{produto.nome}</p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {produto.marca} · {produto.categoria} · {produto.sku}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-semibold">{centavosParaReais(produto.precoVenda)}</span>
                  <EstoqueBadge
                    estoqueAtual={estoqueAtual}
                    estoqueMinimo={produto.estoqueMinimo}
                    tipoVenda={produto.tipoVenda}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
