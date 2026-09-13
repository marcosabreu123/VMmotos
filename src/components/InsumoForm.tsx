"use client";

import { useActionState } from "react";
import type { EstadoInsumo } from "@/app/estoque/insumos/actions";

const ESTADO_INICIAL: EstadoInsumo = {};

export function InsumoForm({
  action,
  valoresIniciais,
}: {
  action: (estado: EstadoInsumo, formData: FormData) => Promise<EstadoInsumo>;
  valoresIniciais?: { nome: string; unidade: string; custoUnitario: number; estoqueAtual: number | null };
}) {
  const [estado, formAction, pendente] = useActionState(action, ESTADO_INICIAL);

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="flex-1" style={{ minWidth: 140 }}>
        <label className="label" htmlFor="nome">
          Nome
        </label>
        <input id="nome" name="nome" required defaultValue={valoresIniciais?.nome} className="input" placeholder="Ex.: Sacola" />
      </div>
      <div style={{ width: 100 }}>
        <label className="label" htmlFor="unidade">
          Unidade
        </label>
        <input id="unidade" name="unidade" required defaultValue={valoresIniciais?.unidade} className="input" placeholder="un" />
      </div>
      <div style={{ width: 140 }}>
        <label className="label" htmlFor="custoUnitario">
          Custo unitário (R$)
        </label>
        <input
          id="custoUnitario"
          name="custoUnitario"
          type="number"
          step="0.01"
          min={0}
          required
          defaultValue={valoresIniciais ? valoresIniciais.custoUnitario / 100 : undefined}
          className="input"
        />
      </div>
      <div style={{ width: 140 }}>
        <label className="label" htmlFor="estoqueAtual">
          Estoque (opcional)
        </label>
        <input
          id="estoqueAtual"
          name="estoqueAtual"
          type="number"
          min={0}
          defaultValue={valoresIniciais?.estoqueAtual ?? undefined}
          className="input"
        />
      </div>
      {estado.erro && (
        <p className="badge badge-danger" role="alert">
          {estado.erro}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pendente}>
        {pendente ? <span className="spinner" /> : "Salvar"}
      </button>
    </form>
  );
}
