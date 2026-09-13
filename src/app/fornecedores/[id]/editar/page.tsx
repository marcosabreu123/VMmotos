import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { FornecedorForm } from "@/app/fornecedores/novo/FornecedorForm";
import { buscarFornecedorPorId } from "@/lib/fornecedores";
import { atualizarFornecedorAction, alterarAtivoFornecedorAction } from "@/app/fornecedores/actions";
import { BotaoAlternarAtivo } from "@/components/BotaoAlternarAtivo";

export default async function EditarFornecedorPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await requireUser();
  const { id } = await params;

  const fornecedor = await buscarFornecedorPorId(id);
  if (!fornecedor) notFound();

  const acaoAtualizar = atualizarFornecedorAction.bind(null, id);

  return (
    <AppShell usuario={usuario}>
      <PageHeader
        title={fornecedor.nome}
        action={
          <BotaoAlternarAtivo
            ativo={fornecedor.ativo}
            acao={alterarAtivoFornecedorAction.bind(null, fornecedor.id, !fornecedor.ativo)}
          />
        }
      />
      {!fornecedor.ativo && <p className="badge badge-danger mb-6 w-fit">Fornecedor arquivado</p>}
      <FornecedorForm action={acaoAtualizar} valoresIniciais={fornecedor} />
    </AppShell>
  );
}
