"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarObservacaoClienteAction } from "../actions";

export function ClienteObservacao({ clienteId, observacoesAtuais }: { clienteId: string; observacoesAtuais: string }) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [editando, setEditando] = useState(false);
  const [observacao, setObservacao] = useState(observacoesAtuais);
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    iniciarTransicao(async () => {
      const resultado = await adicionarObservacaoClienteAction(clienteId, observacao);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      setEditando(false);
      router.refresh();
    });
  }

  if (!editando) {
    return (
      <div>
        {observacoesAtuais && (
          <p className="mb-2 text-sm" style={{ color: "var(--muted)" }}>
            {observacoesAtuais}
          </p>
        )}
        <button type="button" className="btn btn-outline" onClick={() => setEditando(true)}>
          {observacoesAtuais ? "Editar observação" : "Adicionar observação"}
        </button>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3 p-4">
      <textarea className="input" rows={3} value={observacao} onChange={(evento) => setObservacao(evento.target.value)} />
      {erro && (
        <p className="state-error" role="alert">
          {erro}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={pendente} onClick={salvar}>
          {pendente ? <span className="spinner" /> : "Salvar observação"}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setEditando(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
