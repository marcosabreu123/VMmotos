"use client";

import { useActionState } from "react";
import { criarFornecedorAction, type EstadoFornecedor } from "../actions";

const ESTADO_INICIAL: EstadoFornecedor = {};

export type ValoresIniciaisFornecedor = {
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  observacoes: string | null;
};

export function FornecedorForm({
  action = criarFornecedorAction,
  valoresIniciais,
}: {
  action?: (estado: EstadoFornecedor, formData: FormData) => Promise<EstadoFornecedor>;
  valoresIniciais?: ValoresIniciaisFornecedor;
}) {
  const [estado, formAction, pendente] = useActionState(action, ESTADO_INICIAL);

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-6">
      <div>
        <label className="label" htmlFor="nome">
          Nome *
        </label>
        <input
          id="nome"
          name="nome"
          required
          className="input"
          placeholder="Nome do fornecedor"
          defaultValue={valoresIniciais?.nome}
        />
      </div>

      <div>
        <label className="label" htmlFor="documento">
          CNPJ/CPF
        </label>
        <input id="documento" name="documento" className="input" defaultValue={valoresIniciais?.documento ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="telefone">
            Telefone
          </label>
          <input id="telefone" name="telefone" className="input" defaultValue={valoresIniciais?.telefone ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="email">
            E-mail
          </label>
          <input id="email" name="email" type="email" className="input" defaultValue={valoresIniciais?.email ?? ""} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="endereco">
          Endereço
        </label>
        <input id="endereco" name="endereco" className="input" defaultValue={valoresIniciais?.endereco ?? ""} />
      </div>

      <div>
        <label className="label" htmlFor="observacoes">
          Observações
        </label>
        <textarea
          id="observacoes"
          name="observacoes"
          className="input"
          rows={3}
          defaultValue={valoresIniciais?.observacoes ?? ""}
        />
      </div>

      {estado.erro && (
        <p className="badge badge-danger w-fit" role="alert">
          {estado.erro}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={pendente}>
        {pendente ? <span className="spinner" /> : "Salvar fornecedor"}
      </button>
    </form>
  );
}
