import { notFound } from "next/navigation";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { EtiquetaProduto } from "@/components/EtiquetaProduto";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { buscarProdutoPorId } from "@/lib/produtos";

export default async function EtiquetaProdutoPage({
  params,
}: {
  params: Promise<{ produtoId: string }>;
}) {
  const usuario = await requireLeitura("produtos");
  const { produtoId } = await params;

  const produto = await buscarProdutoPorId(produtoId);
  if (!produto) notFound();

  return (
    <AppShell usuario={usuario}>
      <PageHeader
        title={`Etiqueta · ${produto.nome}`}
        action={<BotaoImprimir>Imprimir etiqueta</BotaoImprimir>}
      />

      <EtiquetaProduto
        produto={{
          nome: produto.nome,
          marca: produto.marca,
          medida: produto.medida,
          precoVenda: produto.precoVenda,
          sku: produto.sku,
          codigoBarras: produto.codigoBarras,
        }}
      />
    </AppShell>
  );
}
