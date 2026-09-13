"use client";

import { useActionState, useRef } from "react";
import { criarMecanicoAction, type EstadoMecanico } from "./actions";

const ESTADO_INICIAL: EstadoMecanico = {};

export function MecanicoForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, pendente] = useActionState(
    async (estadoAnterior: EstadoMecanico, formData: FormData) => {
      const resultado = await criarMecanicoAction(estadoAnterior, formData);
      if (!resultado.erro) formRef.current?.reset();
      return resultado;
    },
    ESTADO_INICIAL
  );

  return (
    <form ref={formRef} action={formAction} className="card flex flex-col gap-4 p-6">
      <div>
        <label className="label" htmlFor="nome">
          Nome *
        </label>
        <input id="nome" name="nome" required className="input" placeholder="Verniz" />
        <p className="ajuda">Pode ser o apelido, que é como ele é chamado na oficina.</p>
      </div>

      <div>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="socioOficina" className="mt-1" />
          <span>
            <span className="font-medium">Sócio da oficina</span>
            <span className="ajuda block">
              O sócio leva 50% de toda mão de obra, mesmo a que outro mecânico
              executa, e 100% do que ele mesmo faz. Marque uma pessoa só.
            </span>
          </span>
        </label>
      </div>

      {estado.erro && (
        <p className="badge badge-danger w-fit" role="alert">
          {estado.erro}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={pendente}>
        {pendente ? <span className="spinner" /> : "Salvar mecânico"}
      </button>
    </form>
  );
}
