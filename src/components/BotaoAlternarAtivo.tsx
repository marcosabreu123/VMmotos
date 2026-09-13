"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function BotaoAlternarAtivo({ ativo, acao }: { ativo: boolean; acao: () => Promise<unknown> }) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();

  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        iniciarTransicao(async () => {
          await acao();
          router.refresh();
        })
      }
      className={`btn ${ativo ? "btn-outline" : "btn-primary"}`}
    >
      {pendente ? <span className="spinner" /> : ativo ? "Arquivar" : "Reativar"}
    </button>
  );
}
