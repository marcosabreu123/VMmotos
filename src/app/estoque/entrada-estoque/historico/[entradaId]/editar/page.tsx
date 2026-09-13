import { notFound } from "next/navigation";
import { requireEscrita } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buscarEntradaEstoqueParaEdicao } from "@/lib/entradaEstoque";
import { EditarEntradaEstoqueForm } from "./EditarEntradaEstoqueForm";

export default async function EditarEntradaEstoquePage({
  params,
}: {
  params: Promise<{ entradaId: string }>;
}) {
  const usuario = await requireEscrita("estoque");
  const { entradaId } = await params;

  const entrada = await buscarEntradaEstoqueParaEdicao(entradaId);
  if (!entrada) notFound();

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Editar entrada de estoque" />
      <EditarEntradaEstoqueForm
        entrada={{
          id: entrada.id,
          fornecedor: entrada.fornecedor ? { id: entrada.fornecedor.id, nome: entrada.fornecedor.nome } : null,
          dataEntrada: entrada.dataEntrada.toISOString().slice(0, 10),
          observacoes: entrada.observacoes,
          valorFrete: entrada.valorFrete,
          itens: entrada.itens.map((item) => ({
            id: item.id,
            produtoNome: item.produto.nome,
            tipoVenda: item.produto.tipoVenda,
            quantidade: item.quantidade,
            custoUnitarioStr: (item.custoUnitario / 100).toFixed(2).replace(".", ","),
            bloqueado: item.bloqueado,
          })),
        }}
      />
    </AppShell>
  );
}
