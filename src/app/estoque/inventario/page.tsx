import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarLotesParaContagem } from "@/lib/estoque";
import { InventarioForm } from "./InventarioForm";

export default async function InventarioPage() {
  const usuario = await requireUser();
  const lotes = await listarLotesParaContagem();

  const lotesForm = lotes.map((lote) => ({
    id: lote.id,
    produtoNome: lote.produto.nome,
    numero: lote.numero,
    tipoVenda: lote.produto.tipoVenda,
    quantidadeAtualVenda: lote.quantidadeAtualVenda,
    quantidadeAtualDemonstracao: lote.quantidadeAtualDemonstracao,
  }));

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Contagem de inventário" />
      <InventarioForm lotes={lotesForm} />
    </AppShell>
  );
}
