"use client";

import { useActionState } from "react";
import { IconCheck } from "@/components/icons";
import { atualizarConfigAssistenteAction, type EstadoConfigAssistente } from "./actions";

const ESTADO_INICIAL: EstadoConfigAssistente = {};

export function ConfigAssistenteForm({
  habilitado,
  limiteDiarioPorUsuario,
  valorAltoCentavos,
}: {
  habilitado: boolean;
  limiteDiarioPorUsuario: number;
  valorAltoCentavos: number;
}) {
  const [estado, formAction, pendente] = useActionState(atualizarConfigAssistenteAction, ESTADO_INICIAL);

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-6">
      <label className="flex items-center gap-2">
        <input type="checkbox" name="habilitado" defaultChecked={habilitado} />
        <span>Assistente de IA ativado</span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="limiteDiarioPorUsuario">
            Limite de mensagens por usuário/dia
          </label>
          <input
            id="limiteDiarioPorUsuario"
            name="limiteDiarioPorUsuario"
            type="number"
            min={1}
            defaultValue={limiteDiarioPorUsuario}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="valorAlto">
            Valor considerado alto (venda), em R$
          </label>
          <input
            id="valorAlto"
            name="valorAlto"
            defaultValue={(valorAltoCentavos / 100).toFixed(2).replace(".", ",")}
            className="input"
            required
          />
        </div>
      </div>

      {estado.erro && (
        <p className="state-error" role="alert">
          {estado.erro}
        </p>
      )}
      {estado.sucesso && (
        <div className="state-success" role="status">
          <span className="state-success-icon">
            <IconCheck />
          </span>
          Configuração salva.
        </div>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={pendente}>
        {pendente ? <span className="spinner" /> : "Salvar configuração"}
      </button>
    </form>
  );
}
