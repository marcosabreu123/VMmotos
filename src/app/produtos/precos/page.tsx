import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarPrecos } from "@/lib/precos";
import { podeVerCustos } from "@/lib/permissoes";
import { nicho } from "@/config/nicho";
import { TabelaPrecos } from "./TabelaPrecos";

export default async function PrecosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const usuario = await requireLeitura("produtos");
  const { busca } = await searchParams;

  // Esta tela é custo e margem da loja inteira numa página — quem não pode
  // ver custo não entra, nem em leitura.
  if (!podeVerCustos(usuario.papel)) {
    return (
      <AppShell usuario={usuario} wide>
        <PageHeader title="Preços" />
        <p className="state-error">Você não tem permissão para ver custos e margem.</p>
      </AppShell>
    );
  }

  const linhas = await listarPrecos(busca);

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader
        title="Preços e margem"
        action={
          <Link href="/produtos" className="btn btn-outline">
            Voltar para {nicho.termos.produto.plural.toLowerCase()}
          </Link>
        }
      />

      <p className="ajuda mb-4">
        Altere custo e preço de venda de várias peças e salve tudo de uma vez. O
        lucro e a margem se recalculam enquanto você digita.
      </p>

      <form className="mb-4">
        <input
          name="busca"
          defaultValue={busca}
          placeholder="Filtrar por nome, fabricante, categoria ou código..."
          className="input"
        />
      </form>

      <TabelaPrecos linhas={linhas} />
    </AppShell>
  );
}
