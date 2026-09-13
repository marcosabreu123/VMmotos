import { notFound, redirect } from "next/navigation";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buscarPedidoPorId } from "@/lib/compras";
import { PedidoForm } from "../../novo/PedidoForm";

export default async function EditarPedidoPage({
  params,
}: {
  params: Promise<{ pedidoId: string }>;
}) {
  const usuario = await requireLeitura("compras");
  const { pedidoId } = await params;

  const pedido = await buscarPedidoPorId(pedidoId);
  if (!pedido) notFound();
  if (pedido.status !== "RASCUNHO") {
    redirect(`/compras/${pedidoId}`);
  }

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Editar pedido de compra" />
      <PedidoForm
        modo="editar"
        pedidoId={pedido.id}
        valoresIniciais={{
          fornecedor: { id: pedido.fornecedor.id, nome: pedido.fornecedor.nome },
          itens: pedido.itens.map((item) => ({
            produtoId: item.produtoId,
            nome: item.produto.nome,
            tipoVenda: item.produto.tipoVenda,
            quantidade: item.quantidade,
            quantidadeDemonstracao: item.quantidadeDemonstracao,
            custoUnitario: item.custoUnitario,
          })),
          valorFrete: pedido.valorFrete,
          observacoes: pedido.observacoes,
        }}
      />
    </AppShell>
  );
}
