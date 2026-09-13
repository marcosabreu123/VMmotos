import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarMotos, formatarPlaca } from "@/lib/motos";
import { podeEscrever } from "@/lib/permissoes";
import { MotoForm } from "./MotoForm";

export default async function MotosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>;
}) {
  const usuario = await requireLeitura("motos");
  const { busca } = await searchParams;
  const motos = await listarMotos(busca);

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Motos" />

      {podeEscrever(usuario, "motos") && (
        <section className="mb-8">
          <h2 className="label-caps mb-3">Cadastrar moto</h2>
          <MotoForm />
        </section>
      )}

      <section>
        <h2 className="label-caps mb-3">Buscar</h2>
        <form className="mb-4">
          <input
            name="busca"
            defaultValue={busca}
            placeholder="Placa, modelo ou cliente..."
            className="input"
          />
        </form>

        {motos.length === 0 ? (
          <p className="state-empty">
            {busca
              ? "Nenhuma moto encontrada com esse termo."
              : "Nenhuma moto cadastrada ainda."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {motos.map((moto) => (
              <li key={moto.id}>
                <Link
                  href={`/motos/${moto.id}`}
                  className="card card-interactive flex flex-wrap items-center justify-between gap-2 p-4"
                >
                  <span>
                    <span className="font-serif text-lg font-bold">
                      {formatarPlaca(moto.placa)}
                    </span>
                    {moto.modelo && (
                      <span className="ml-2 text-sm" style={{ color: "var(--muted)" }}>
                        {moto.modelo}
                      </span>
                    )}
                    {moto.cliente && (
                      <span className="block text-sm" style={{ color: "var(--muted)" }}>
                        {moto.cliente.nome}
                      </span>
                    )}
                  </span>
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {moto._count.vendas === 0
                      ? "Sem atendimento"
                      : `${moto._count.vendas} atendimento${moto._count.vendas > 1 ? "s" : ""}`}
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
