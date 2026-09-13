import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { DespesaForm } from "@/components/DespesaForm";
import { listarCategoriasDespesa } from "@/lib/despesas";
import { listarFornecedores } from "@/lib/fornecedores";
import { criarDespesaAction } from "../actions";

export default async function NovaDespesaPage() {
  const usuario = await requireLeitura("despesas");
  const [categorias, fornecedores] = await Promise.all([listarCategoriasDespesa(), listarFornecedores()]);

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Nova despesa" />
      <DespesaForm action={criarDespesaAction} categorias={categorias} fornecedores={fornecedores} />
    </AppShell>
  );
}
