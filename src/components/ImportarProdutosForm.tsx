"use client";

import { useActionState } from "react";
import { importarProdutosAction, type EstadoImportacao } from "@/app/ferramentas/importar/actions";

const ESTADO_INICIAL: EstadoImportacao = {};

export function ImportarProdutosForm() {
  const [estado, formAction, pendente] = useActionState(importarProdutosAction, ESTADO_INICIAL);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="card flex flex-col gap-4 p-6">
        <div>
          <label className="label" htmlFor="arquivo">
            Arquivo CSV
          </label>
          <input id="arquivo" name="arquivo" type="file" accept=".csv,text/csv" required className="input" />
        </div>

        {estado.erro && <p className="text-sm" style={{ color: "var(--danger)" }}>{estado.erro}</p>}

        <button type="submit" disabled={pendente} className="btn btn-primary w-fit">
          {pendente ? <span className="spinner" /> : "Importar produtos"}
        </button>
      </form>

      {estado.resumo && (
        <div className="card p-6">
          <p className="mb-3 font-semibold">
            {estado.resumo.sucesso} de {estado.resumo.total} linha(s) importada(s) com sucesso
            {estado.resumo.comAviso > 0 && ` · ${estado.resumo.comAviso} aviso(s)`}
          </p>
          {estado.resumo.avisos.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm" style={{ color: "var(--muted)" }}>
              {estado.resumo.avisos.map((aviso, indice) => (
                <li key={indice}>{aviso}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
