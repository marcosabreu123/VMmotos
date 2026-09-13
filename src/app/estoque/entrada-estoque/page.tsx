import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buscarProdutoPorId } from "@/lib/produtos";
import { EntradaEstoqueForm } from "./EntradaEstoqueForm";

export default async function EntradaEstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ produtoId?: string }>;
}) {
  const usuario = await requireUser();
  const { produtoId } = await searchParams;

  const produto = produtoId ? await buscarProdutoPorId(produtoId) : null;

  return (
    <AppShell usuario={usuario}>
      <PageHeader
        title="Nova Entrada de Estoque"
        action={
          <Link href="/estoque/entrada-estoque/historico" className="btn btn-outline">
            Histórico de entradas
          </Link>
        }
      />
      <EntradaEstoqueForm
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
