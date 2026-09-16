import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProdutoForm } from "@/components/ProdutoForm";
import { listarFornecedores } from "@/lib/fornecedores";
import { podeVerCustos } from "@/lib/permissoes";
import { criarProdutoAction } from "../actions";
import { nicho } from "@/config/nicho";

export default async function NovoProdutoPage({
  searchParams,
}: {
  // Vem preenchido quando o dono bipou na venda uma peça que ainda não existia.
  searchParams: Promise<{ codigo?: string }>;
}) {
  const usuario = await requireUser();
  const [fornecedores, { codigo }] = await Promise.all([listarFornecedores(), searchParams]);

  return (
    <AppShell usuario={usuario}>
      <PageHeader title={`Nova ${nicho.termos.produto.singular.toLowerCase()}`} />
      <ProdutoForm
        action={criarProdutoAction}
        fornecedores={fornecedores}
        podeVerCustos={podeVerCustos(usuario.papel)}
        codigoInicial={codigo?.trim() || undefined}
      />
    </AppShell>
  );
}
