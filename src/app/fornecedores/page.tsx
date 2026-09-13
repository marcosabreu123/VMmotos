import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarFornecedores } from "@/lib/fornecedores";

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; filtro?: string }>;
}) {
  const usuario = await requireUser();
  const { busca, filtro } = await searchParams;
  const arquivados = filtro === "arquivados";
  const fornecedores = await listarFornecedores(busca, arquivados);

  return (
    <AppShell usuario={usuario}>
      <PageHeader
        title={arquivados ? "Fornecedores arquivados" : "Fornecedores"}
        action={
          <Link href="/fornecedores/novo" className="btn btn-primary">
            + Novo fornecedor
          </Link>
        }
      />

      <form className="mb-3">
        <input name="busca" defaultValue={busca} placeholder="Buscar fornecedor por nome..." className="input" />
        {arquivados && <input type="hidden" name="filtro" value="arquivados" />}
      </form>

      {!arquivados ? (
        <Link href="/fornecedores?filtro=arquivados" className="label-caps mb-6 inline-block" style={{ color: "var(--muted)" }}>
          Ver arquivados
        </Link>
      ) : (
        <Link href="/fornecedores" className="label-caps mb-6 inline-block" style={{ color: "var(--accent)" }}>
          ← ver todos os fornecedores
        </Link>
      )}

      {fornecedores.length === 0 ? (
        <p className="state-empty">Nenhum fornecedor encontrado.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {fornecedores.map((fornecedor) => (
            <li key={fornecedor.id} className="card flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-semibold">{fornecedor.nome}</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  {[fornecedor.telefone, fornecedor.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
                </p>
              </div>
              <Link href={`/fornecedores/${fornecedor.id}/editar`} className="btn btn-outline">
                Editar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
