import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buscarProdutoPorId } from "@/lib/produtos";
import { AjusteForm } from "./AjusteForm";

export default async function AjusteEstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ produtoId?: string }>;
}) {
  const usuario = await requireUser();
  const { produtoId } = await searchParams;

  const produto = produtoId ? await buscarProdutoPorId(produtoId) : null;

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Ajuste de estoque" />
      <AjusteForm
        produtoInicial={
          produto
            ? {
                id: produto.id,
                nome: produto.nome,
                marca: produto.marca,
                sku: produto.sku,
                precoVenda: produto.precoVenda,
                tipoVenda: produto.tipoVenda,
              }
            : undefined
        }
      />
    </AppShell>
  );
}
