"use client";

import { useActionState, useRef } from "react";
import { criarClienteAction, type EstadoCliente } from "./actions";

const ESTADO_INICIAL: EstadoCliente = {};

export function ClienteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, pendente] = useActionState(async (estadoAnterior: EstadoCliente, formData: FormData) => {
    const resultado = await criarClienteAction(estadoAnterior, formData);
    if (!resultado.erro) {
      formRef.current?.reset();
    }
    return resultado;
  }, ESTADO_INICIAL);

  return (
    <form ref={formRef} action={formAction} className="card flex flex-col gap-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nome">
            Nome *
          </label>
          <input id="nome" name="nome" required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="telefone">
            Telefone
          </label>
          <input id="telefone" name="telefone" className="input" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input id="email" name="email" type="email" className="input" />
      </div>

      {estado.erro && (
        <p className="badge badge-danger w-fit" role="alert">
          {estado.erro}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={pendente}>
        {pendente ? <span className="spinner" /> : "Salvar cliente"}
      </button>
    </form>
  );
}
