"use client";

import { useActionState, useRef } from "react";
import { criarUsuarioAction, type EstadoUsuario } from "./actions";

const ESTADO_INICIAL: EstadoUsuario = {};

export function UsuarioForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, formAction, pendente] = useActionState(async (estadoAnterior: EstadoUsuario, formData: FormData) => {
    const resultado = await criarUsuarioAction(estadoAnterior, formData);
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
          <label className="label" htmlFor="email">
            E-mail *
          </label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="senha">
            Senha *
          </label>
          <input id="senha" name="senha" type="password" required minLength={6} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="papel">
            Permissão
          </label>
          <select id="papel" name="papel" defaultValue="SELLER" className="input">
            <option value="SELLER">Vendedor</option>
            <option value="ESTOQUE">Estoque</option>
            <option value="GERENTE">Gerente</option>
            <option value="CONSULTA">Consulta</option>
            <option value="OWNER">Dono</option>
          </select>
        </div>
      </div>

      {estado.erro && (
        <p className="badge badge-danger w-fit" role="alert">
          {estado.erro}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={pendente}>
        {pendente ? <span className="spinner" /> : "Criar usuário"}
      </button>
    </form>
  );
}
