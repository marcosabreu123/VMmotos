"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StatusLote } from "@prisma/client";
import {
  alterarStatusLoteAction,
  transferirEstoqueAction,
  registrarSaidaDemonstracaoAction,
  ajustarEstoqueAction,
} from "../actions";

export function LoteAcoes({
  loteId,
  status,
  unidade,
}: {
  loteId: string;
  status: StatusLote;
  unidade: "ml" | "un.";
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [mostrarTransferencia, setMostrarTransferencia] = useState(false);
  const [sentido, setSentido] = useState<"VENDA_PARA_DEMONSTRACAO" | "DEMONSTRACAO_PARA_VENDA">("VENDA_PARA_DEMONSTRACAO");
  const [quantidadeTransferencia, setQuantidadeTransferencia] = useState("");

  const [mostrarSaidaDemonstracao, setMostrarSaidaDemonstracao] = useState(false);
  const [quantidadeSaida, setQuantidadeSaida] = useState("");
  const [motivoSaida, setMotivoSaida] = useState("");

  const [mostrarAjuste, setMostrarAjuste] = useState(false);
  const [poolAjuste, setPoolAjuste] = useState<"VENDA" | "DEMONSTRACAO">("VENDA");
  const [tipoAjuste, setTipoAjuste] = useState<"AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO" | "PERDA_VENCIMENTO">(
    "AJUSTE_POSITIVO"
  );
  const [quantidadeAjuste, setQuantidadeAjuste] = useState("");
  const [motivoAjuste, setMotivoAjuste] = useState("");

  function alternarStatus() {
    iniciarTransicao(async () => {
      const resultado = await alterarStatusLoteAction(loteId, status === "ATIVO" ? "BLOQUEADO" : "ATIVO");
      if (!resultado.ok) {
        setMensagem(resultado.erro);
        return;
      }
      setMensagem(null);
      router.refresh();
    });
  }

  function confirmarTransferencia() {
    const quantidade = Number(quantidadeTransferencia) || 0;
    if (quantidade <= 0) {
      setMensagem("Informe uma quantidade válida.");
      return;
    }
    iniciarTransicao(async () => {
      const resultado = await transferirEstoqueAction({ loteId, sentido, quantidade });
      if (!resultado.ok) {
        setMensagem(resultado.erro);
        return;
      }
      setMensagem(null);
      setMostrarTransferencia(false);
      setQuantidadeTransferencia("");
      router.refresh();
    });
  }

  function confirmarSaidaDemonstracao() {
    const quantidade = Number(quantidadeSaida) || 0;
    if (quantidade <= 0) {
      setMensagem("Informe uma quantidade válida.");
      return;
    }
    if (!motivoSaida.trim()) {
      setMensagem("Informe o motivo da saída.");
      return;
    }
    iniciarTransicao(async () => {
      const resultado = await registrarSaidaDemonstracaoAction({ loteId, quantidade, motivo: motivoSaida });
      if (!resultado.ok) {
        setMensagem(resultado.erro);
        return;
      }
      setMensagem(null);
      setMostrarSaidaDemonstracao(false);
      setQuantidadeSaida("");
      setMotivoSaida("");
      router.refresh();
    });
  }

  function confirmarAjuste() {
    const quantidade = Number(quantidadeAjuste) || 0;
    if (quantidade <= 0) {
      setMensagem("Informe uma quantidade válida.");
      return;
    }
    if (!motivoAjuste.trim()) {
      setMensagem("Informe o motivo do ajuste.");
      return;
    }
    iniciarTransicao(async () => {
      const resultado = await ajustarEstoqueAction({
        loteId,
        pool: poolAjuste,
        tipo: tipoAjuste,
        quantidade,
        motivo: motivoAjuste,
      });
      if (!resultado.ok) {
        setMensagem(resultado.erro);
        return;
      }
      setMensagem(null);
      setMostrarAjuste(false);
      setQuantidadeAjuste("");
      setMotivoAjuste("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline" disabled={pendente} onClick={alternarStatus}>
          {status === "ATIVO" ? "Bloquear lote" : "Desbloquear lote"}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setMostrarTransferencia((v) => !v)}>
          Transferir venda/demonstracao
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setMostrarSaidaDemonstracao((v) => !v)}>
          Registrar saída de demonstracao
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setMostrarAjuste((v) => !v)}>
          Ajuste manual
        </button>
      </div>

      {mensagem && (
        <p className="state-error" role="alert">
          {mensagem}
        </p>
      )}

      {mostrarTransferencia && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Transferência entre pools</p>
          <select
            className="input"
            value={sentido}
            onChange={(evento) => setSentido(evento.target.value as typeof sentido)}
          >
            <option value="VENDA_PARA_DEMONSTRACAO">Venda → Demonstracao</option>
            <option value="DEMONSTRACAO_PARA_VENDA">Demonstracao → Venda</option>
          </select>
          <input
            type="number"
            min={1}
            className="input"
            placeholder={`Quantidade (${unidade})`}
            value={quantidadeTransferencia}
            onChange={(evento) => setQuantidadeTransferencia(evento.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={confirmarTransferencia}>
              {pendente ? <span className="spinner" /> : "Confirmar transferência"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMostrarTransferencia(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {mostrarSaidaDemonstracao && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Saída de demonstracao</p>
          <input
            type="number"
            min={1}
            className="input"
            placeholder={`Quantidade (${unidade})`}
            value={quantidadeSaida}
            onChange={(evento) => setQuantidadeSaida(evento.target.value)}
          />
          <textarea
            className="input"
            rows={2}
            placeholder="Motivo *"
            value={motivoSaida}
            onChange={(evento) => setMotivoSaida(evento.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={confirmarSaidaDemonstracao}>
              {pendente ? <span className="spinner" /> : "Confirmar saída"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMostrarSaidaDemonstracao(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {mostrarAjuste && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Ajuste manual de estoque</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select
              className="input"
              value={poolAjuste}
              onChange={(evento) => setPoolAjuste(evento.target.value as typeof poolAjuste)}
            >
              <option value="VENDA">Pool venda</option>
              <option value="DEMONSTRACAO">Pool demonstracao</option>
            </select>
            <select
              className="input"
              value={tipoAjuste}
              onChange={(evento) => setTipoAjuste(evento.target.value as typeof tipoAjuste)}
            >
              <option value="AJUSTE_POSITIVO">Ajuste positivo</option>
              <option value="AJUSTE_NEGATIVO">Ajuste negativo</option>
              <option value="PERDA_VENCIMENTO">Perda por vencimento</option>
            </select>
          </div>
          <input
            type="number"
            min={1}
            className="input"
            placeholder={`Quantidade (${unidade})`}
            value={quantidadeAjuste}
            onChange={(evento) => setQuantidadeAjuste(evento.target.value)}
          />
          <textarea
            className="input"
            rows={2}
            placeholder="Motivo *"
            value={motivoAjuste}
            onChange={(evento) => setMotivoAjuste(evento.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={confirmarAjuste}>
              {pendente ? <span className="spinner" /> : "Confirmar ajuste"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMostrarAjuste(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
