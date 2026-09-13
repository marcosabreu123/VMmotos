"use client";

import { ClienteAutocomplete, type ClienteBusca } from "./ClienteAutocomplete";
import { IconTrocar } from "./icons";

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "").join("") || "?";
}

export function ClienteSelector({
  cliente,
  onSelecionar,
  onRemover,
}: {
  cliente: ClienteBusca | null;
  onSelecionar: (cliente: ClienteBusca) => void;
  onRemover: () => void;
}) {
  if (!cliente) {
    return <ClienteAutocomplete onSelecionar={onSelecionar} />;
  }

  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="avatar">{iniciaisDoNome(cliente.nome)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{cliente.nome}</p>
        <p className="truncate text-sm" style={{ color: "var(--muted)" }}>
          {cliente.telefone ?? "Sem telefone"} · {cliente.totalCompras}{" "}
          {cliente.totalCompras === 1 ? "compra" : "compras"}
        </p>
      </div>
      <button
        type="button"
        className="label-caps flex items-center gap-1"
        style={{ color: "var(--accent)" }}
        onClick={onRemover}
      >
        <IconTrocar />
        Trocar
      </button>
    </div>
  );
}
