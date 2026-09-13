import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarClientes } from "@/lib/clientes";
import { ClienteForm } from "./ClienteForm";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; filtro?: string }>;
}) {
  const usuario = await requireLeitura("clientes");
  const { busca, filtro } = await searchParams;
  const arquivados = filtro === "arquivados";
  const clientes = await listarClientes(busca, arquivados);

  return (
    <AppShell usuario={usuario}>
      <PageHeader title={arquivados ? "Clientes arquivados" : "Clientes"} />

      <section className="mb-8">
        <h2 className="label-caps mb-3">Novo cliente</h2>
        <ClienteForm />
      </section>

      <section>
        <h2 className="label-caps mb-3">Buscar</h2>
        <form className="mb-4">
          <input name="busca" defaultValue={busca} placeholder="Nome ou telefone..." className="input" />
          {arquivados && <input type="hidden" name="filtro" value="arquivados" />}
        </form>

        {!arquivados ? (
          <Link href="/clientes?filtro=arquivados" className="label-caps mb-4 inline-block" style={{ color: "var(--muted)" }}>
            Ver arquivados
          </Link>
        ) : (
          <Link href="/clientes" className="label-caps mb-4 inline-block" style={{ color: "var(--accent)" }}>
            â† ver todos os clientes
          </Link>
        )}

        {clientes.length === 0 ? (
          <p className="state-empty">Nenhum cliente encontrado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {clientes.map((cliente) => (
              <li key={cliente.id}>
                <Link href={`/clientes/${cliente.id}`} className="card card-interactive flex items-center justify-between p-4">
                  <span className="font-medium">{cliente.nome}</span>
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {cliente.telefone ?? "Sem telefone"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
