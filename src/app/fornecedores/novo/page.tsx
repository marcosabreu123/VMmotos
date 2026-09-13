import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { FornecedorForm } from "./FornecedorForm";

export default async function NovoFornecedorPage() {
  const usuario = await requireUser();

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Novo fornecedor" />
      <FornecedorForm />
    </AppShell>
  );
}
