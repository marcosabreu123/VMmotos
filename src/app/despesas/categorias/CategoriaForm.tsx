"use client";

import { useActionState } from "react";
import { criarCategoriaDespesaAction, type EstadoCategoria } from "../actions";

const ESTADO_INICIAL: EstadoCategoria = {};

export function CategoriaForm() {
  const [estado, formAction, pendente] = useActionState(criarCategoriaDespesaAction, ESTADO_INICIAL);

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="flex-1">
        <label className="label" htmlFor="nome">
          Nome da categoria
        </label>
        <input id="nome" name="nome" required className="input" placeholder="Ex.: Consultoria" />
      </div>
      {estado.erro && (
        <p className="badge badge-danger" role="alert">
          {estado.erro}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pendente}>
        {pendente ? <span className="spinner" /> : "Adicionar categoria"}
      </button>
    </form>
  );
}
