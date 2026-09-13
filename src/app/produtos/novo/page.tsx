import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProdutoForm } from "@/components/ProdutoForm";
import { listarFornecedores } from "@/lib/fornecedores";
import { podeVerCustos } from "@/lib/permissoes";
import { criarProdutoAction } from "../actions";

export default async function NovoProdutoPage() {
  const usuario = await requireUser();
  const fornecedores = await listarFornecedores();

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Novo produto" />
      <ProdutoForm action={criarProdutoAction} fornecedores={fornecedores} podeVerCustos={podeVerCustos(usuario.papel)} />
    </AppShell>
  );
}
