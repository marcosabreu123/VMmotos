"use client";

import { useTransition } from "react";
import { alternarAtivoUsuarioAction } from "./actions";

export function ToggleAtivoButton({ usuarioId, ativo }: { usuarioId: string; ativo: boolean }) {
  const [pendente, iniciarTransicao] = useTransition();

  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => iniciarTransicao(() => alternarAtivoUsuarioAction(usuarioId, !ativo))}
      className={`btn ${ativo ? "btn-outline" : "btn-primary"}`}
    >
      {pendente ? <span className="spinner" /> : ativo ? "Desativar" : "Reativar"}
    </button>
  );
}
