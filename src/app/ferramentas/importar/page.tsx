import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ImportarProdutosForm } from "@/components/ImportarProdutosForm";
import { nicho } from "@/config/nicho";

export default async function ImportarProdutosPage() {
  const usuario = await requireLeitura("produtos");

  return (
    <AppShell usuario={usuario}>
      <PageHeader
        title={`Importar ${nicho.termos.produto.plural.toLowerCase()}`}
        action={
          <a href="/api/produtos/exportar" className="btn btn-outline">
            Baixar modelo (exportar CSV atual)
          </a>
        }
      />

      <div className="card mb-6 p-6 text-sm" style={{ color: "var(--muted)" }}>
        <p className="mb-2">
          O arquivo deve ser um CSV com cabeçalho na primeira linha. Colunas obrigatórias:{" "}
          <strong>nome, marca, categoria, sku, precoVenda</strong>. Colunas opcionais: medida,
          codigoBarras, precoCustoRef, fornecedor, atributoA, atributoB, tipoVenda,
          estoqueMinimo, ativo.
        </p>
        <p className="mb-2">
          Produtos são identificados pelo <strong>SKU</strong>: se já existir um produto com o
          mesmo SKU, ele é atualizado; caso contrário, um novo produto é criado.
        </p>
        <p>
          O fornecedor deve corresponder exatamente ao nome de um fornecedor já cadastrado —
          fornecedores não são criados automaticamente pela importação.
        </p>
      </div>

      <ImportarProdutosForm />

      <Link href="/produtos" className="label-caps mt-6 inline-block" style={{ color: "var(--accent)" }}>
        ← voltar para produtos
      </Link>
    </AppShell>
  );
}
