import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buscarProdutoPorId } from "@/lib/produtos";
import { AssistenteBotaoFlutuante } from "@/components/assistente/AssistenteBotaoFlutuante";
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

      {/* Única tela do sistema com o assistente de IA, por decisão do dono:
          é aqui que ele ajuda de verdade — ler o pedido do fornecedor em vez
          de digitar item por item. */}
      <AssistenteBotaoFlutuante usuario={usuario} />
    </AppShell>
  );
}
