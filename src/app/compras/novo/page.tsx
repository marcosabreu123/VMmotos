import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PedidoForm } from "./PedidoForm";

export default async function NovoPedidoPage() {
  const usuario = await requireLeitura("compras");

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Novo pedido de compra" />
      <PedidoForm modo="criar" />
    </AppShell>
  );
}
