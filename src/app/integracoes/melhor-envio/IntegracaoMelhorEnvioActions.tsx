"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function IntegracaoMelhorEnvioActions({ conectado }: { conectado: boolean }) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const [confirmandoDesconexao, setConfirmandoDesconexao] = useState(false);

  function testarConexao() {
    setMensagem(null);
    iniciarTransicao(async () => {
      const resposta = await fetch("/api/integracoes/melhor-envio/testar", { method: "POST" });
      const dados = await resposta.json();
      if (!resposta.ok || !dados.ok) {
        setMensagem({ tipo: "erro", texto: dados.erro ?? "Não foi possível testar a conexão." });
        return;
      }
      setMensagem({ tipo: "sucesso", texto: "Conexão com o Melhor Envio funcionando normalmente." });
    });
  }

  function desconectar() {
    setMensagem(null);
    iniciarTransicao(async () => {
      const resposta = await fetch("/api/integracoes/melhor-envio/desconectar", { method: "POST" });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setMensagem({ tipo: "erro", texto: dados.erro ?? "Não foi possível desconectar." });
        return;
      }
      setConfirmandoDesconexao(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {!conectado && (
          <a href="/api/integracoes/melhor-envio/conectar" className="btn btn-primary">
            Conectar ao Melhor Envio
          </a>
        )}
        {conectado && (
          <>
            <a href="/api/integracoes/melhor-envio/conectar" className="btn btn-outline">
              Reconectar
            </a>
            <button type="button" className="btn btn-outline" onClick={testarConexao} disabled={pendente}>
              {pendente ? <span className="spinner" /> : "Testar conexão"}
            </button>
            {!confirmandoDesconexao && (
              <button type="button" className="btn btn-outline" onClick={() => setConfirmandoDesconexao(true)}>
                Desconectar
              </button>
            )}
          </>
        )}
      </div>

      {confirmandoDesconexao && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="text-sm">
            Ao desconectar, novas cotações ficam bloqueadas até reconectar a integração. Confirma a desconexão?
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={desconectar} disabled={pendente}>
              {pendente ? <span className="spinner" /> : "Confirmar desconexão"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setConfirmandoDesconexao(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mensagem?.tipo === "erro" && (
        <p className="state-error" role="alert">
          {mensagem.texto}
        </p>
      )}
      {mensagem?.tipo === "sucesso" && (
        <div className="state-success" role="status">
          {mensagem.texto}
        </div>
      )}
    </div>
  );
}
