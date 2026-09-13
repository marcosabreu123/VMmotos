import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EstoqueBadge } from "@/components/EstoqueBadge";
import { estoqueTotalProduto, listarProdutos } from "@/lib/produtos";
import { produtosAbaixoDoMinimo, produtosSemEstoque } from "@/lib/estoque";
import { centavosParaReais } from "@/lib/money";

const TITULOS_FILTRO: Record<string, string> = {
  "estoque-baixo": "Produtos com estoque baixo",
  "sem-estoque": "Produtos sem estoque",
  arquivados: "Produtos arquivados",
};

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; filtro?: string }>;
}) {
  const usuario = await requireUser();
  const { busca, filtro } = await searchParams;

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
  } else if (filtro === "arquivados") {
    const produtos = await listarProdutos(busca, true);
    const estoques = await Promise.all(produtos.map((produto) => estoqueTotalProduto(produto.id)));
    itens = produtos.map((produto, indice) => ({ produto, estoqueAtual: estoques[indice] }));
  } else {
    const produtos = await listarProdutos(busca);
    const estoques = await Promise.all(produtos.map((produto) => estoqueTotalProduto(produto.id)));
    itens = produtos.map((produto, indice) => ({ produto, estoqueAtual: estoques[indice] }));
  }

  return (
    <AppShell usuario={usuario}>
      <PageHeader
        title={filtro ? TITULOS_FILTRO[filtro] ?? "Produtos" : "Produtos"}
        action={
          <div className="flex flex-wrap gap-2">
            <a href="/api/produtos/exportar" className="btn btn-outline">
              Exportar CSV
            </a>
            <Link href="/ferramentas/importar" className="btn btn-outline">
              Importar CSV
            </Link>
            <Link href="/produtos/novo" className="btn btn-primary">
              + Novo produto
            </Link>
          </div>
        }
      />

      {filtro && (
        <Link href="/produtos" className="label-caps mb-4 inline-block" style={{ color: "var(--accent)" }}>
          ← ver todos os produtos
        </Link>
      )}

      {!filtro && (
        <>
          <form className="mb-3">
            <input
              name="busca"
              defaultValue={busca}
              placeholder="Buscar por nome, marca, SKU ou código de barras..."
              className="input"
            />
          </form>
          <Link href="/produtos?filtro=arquivados" className="label-caps mb-6 inline-block" style={{ color: "var(--muted)" }}>
            Ver arquivados
          </Link>
        </>
      )}

      {itens.length === 0 ? (
        <p className="state-empty">Nenhum produto encontrado.</p>
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
                    {produto.marca} · {produto.categoria} · SKU {produto.sku}
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
