"use client";

import { useActionState, useRef } from "react";
import { criarMotoAction, type EstadoMoto } from "./actions";

const ESTADO_INICIAL: EstadoMoto = {};

export function MotoForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, pendente] = useActionState(
    async (estadoAnterior: EstadoMoto, formData: FormData) => {
      const resultado = await criarMotoAction(estadoAnterior, formData);
      if (!resultado.erro) formRef.current?.reset();
      return resultado;
    },
    ESTADO_INICIAL
  );

  return (
    <form ref={formRef} action={formAction} className="card flex flex-col gap-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="placa">
            Placa *
          </label>
          <input
            id="placa"
            name="placa"
            required
            className="input"
            placeholder="ABC1D23"
            autoCapitalize="characters"
            autoComplete="off"
            // O teclado do celular abre em maiúsculas e o campo mostra em
            // maiúsculas; a normalização de verdade acontece no servidor.
            style={{ textTransform: "uppercase" }}
          />
          <p className="ajuda">Pode digitar com ou sem hífen.</p>
        </div>
        <div>
          <label className="label" htmlFor="modelo">
            Modelo
          </label>
          <input id="modelo" name="modelo" className="input" placeholder="CG 160 Fan" />
          <p className="ajuda">Opcional.</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="observacoes">
          Observação
        </label>
        <input id="observacoes" name="observacoes" className="input" placeholder="Cor, detalhe, dono..." />
        <p className="ajuda">Opcional.</p>
      </div>

      {estado.erro && (
        <p className="badge badge-danger w-fit" role="alert">
          {estado.erro}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={pendente}>
        {pendente ? <span className="spinner" /> : "Salvar moto"}
      </button>
    </form>
  );
}
