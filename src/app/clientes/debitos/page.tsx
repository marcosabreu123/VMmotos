import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarClientesEmDebito } from "@/lib/vendas";
import { centavosParaReais } from "@/lib/money";

export default async function ClientesEmDebitoPage() {
  const usuario = await requireLeitura("clientes");

  const clientes = await listarClientesEmDebito();
  const totalGeral = clientes.reduce((soma, linha) => soma + linha.saldoDevedor, 0);

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Clientes em débito" />

      {clientes.length > 0 && (
        <div className="card mb-6 p-5">
          <p className="label-caps mb-1">Total em aberto</p>
          <p className="resumo-total-valor">{centavosParaReais(totalGeral)}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {clientes.length} cliente(s) com saldo devedor
          </p>
        </div>
      )}

      {clientes.length === 0 ? (
        <p className="state-empty">Nenhum cliente com débito em aberto no momento.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clientes.map((linha) => (
            <li key={linha.cliente.id}>
              <Link
                href={`/clientes/${linha.cliente.id}`}
                className="card card-interactive flex items-center justify-between p-4"
              >
                <div>
                  <p className="font-medium">{linha.cliente.nome}</p>
                  {linha.cliente.telefone && (
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {linha.cliente.telefone}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold" style={{ color: "var(--danger)" }}>
                    {centavosParaReais(linha.saldoDevedor)}
                  </p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {linha.quantidadeVendas} venda(s) em aberto
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
