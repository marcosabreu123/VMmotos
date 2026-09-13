"use client";

import { useState, useTransition } from "react";
import { fecharMecanicoAction } from "./actions";

/**
 * Pagar o que um mecânico tem a receber.
 *
 * Pede confirmação porque é pagamento de dinheiro e não tem "desfazer": o
 * fechamento marca os repasses como pagos e lança a despesa.
 */
export function BotaoFechar({
  mecanicoId,
  nome,
  valorFormatado,
}: {
  mecanicoId: string;
  nome: string;
  valorFormatado: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [processando, iniciar] = useTransition();

  function confirmar() {
    setMensagem(null);
    iniciar(async () => {
      const r = await fecharMecanicoAction(mecanicoId);
      setConfirmando(false);
      setMensagem(r.ok ? { tipo: "ok", texto: r.mensagem } : { tipo: "erro", texto: r.erro });
    });
  }

  if (mensagem?.tipo === "ok") {
    return (
      <p className="badge badge-success" role="status">
        {mensagem.texto}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {confirmando ? (
        <>
          <span className="text-sm">
            Pagar <strong>{valorFormatado}</strong> a {nome}?
          </span>
          <button type="button" className="btn btn-primary" onClick={confirmar} disabled={processando}>
            {processando ? <span className="spinner" /> : "Sim, paguei"}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setConfirmando(false)}
            disabled={processando}
          >
            Cancelar
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setConfirmando(true)}>
          Fechar e pagar {valorFormatado}
        </button>
      )}

      {mensagem?.tipo === "erro" && (
        <p className="badge badge-danger" role="alert">
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
