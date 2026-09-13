"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelarDespesaAction,
  duplicarDespesaAction,
  encerrarRecorrenciaAction,
  marcarComoPagaAction,
  pausarRecorrenciaAction,
  retomarRecorrenciaAction,
} from "../actions";
import { IconCheck } from "@/components/icons";

export function DespesaAcoes({
  despesaId,
  status,
  ehTemplateRecorrencia,
  statusRecorrencia,
}: {
  despesaId: string;
  status: "PENDENTE" | "PAGO" | "CANCELADO";
  ehTemplateRecorrencia: boolean;
  statusRecorrencia: "ATIVA" | "PAUSADA" | "ENCERRADA" | null;
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);

  const [mostrarPagar, setMostrarPagar] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [formaPagamento, setFormaPagamento] = useState("PIX");

  const [mostrarCancelar, setMostrarCancelar] = useState(false);
  const [motivo, setMotivo] = useState("");

  function confirmarPagamento() {
    iniciarTransicao(async () => {
      const resultado = await marcarComoPagaAction(despesaId, dataPagamento, formaPagamento as never);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      setMostrarPagar(false);
      router.refresh();
    });
  }

  function confirmarCancelamento() {
    if (!motivo.trim()) {
      setMensagem({ tipo: "erro", texto: "Informe o motivo do cancelamento." });
      return;
    }
    iniciarTransicao(async () => {
      const resultado = await cancelarDespesaAction(despesaId, motivo);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      setMostrarCancelar(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {status === "PENDENTE" && (
          <button type="button" className="btn btn-primary" onClick={() => setMostrarPagar(true)}>
            Marcar como paga
          </button>
        )}
        {status === "PENDENTE" && (
          <button type="button" className="btn btn-outline" onClick={() => setMostrarCancelar(true)}>
            Cancelar
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline"
          disabled={pendente}
          onClick={() => iniciarTransicao(() => duplicarDespesaAction(despesaId))}
        >
          Duplicar
        </button>

        {ehTemplateRecorrencia && statusRecorrencia === "ATIVA" && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={pendente}
            onClick={() => iniciarTransicao(async () => { await pausarRecorrenciaAction(despesaId); router.refresh(); })}
          >
            Pausar recorrência
          </button>
        )}
        {ehTemplateRecorrencia && statusRecorrencia === "PAUSADA" && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={pendente}
            onClick={() => iniciarTransicao(async () => { await retomarRecorrenciaAction(despesaId); router.refresh(); })}
          >
            Retomar recorrência
          </button>
        )}
        {ehTemplateRecorrencia && statusRecorrencia !== "ENCERRADA" && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={pendente}
            onClick={() => iniciarTransicao(async () => { await encerrarRecorrenciaAction(despesaId); router.refresh(); })}
          >
            Encerrar recorrência
          </button>
        )}
      </div>

      {mensagem?.tipo === "erro" && (
        <p className="state-error" role="alert">
          {mensagem.texto}
        </p>
      )}
      {mensagem?.tipo === "sucesso" && (
        <div className="state-success" role="status">
          <span className="state-success-icon">
            <IconCheck />
          </span>
          <span>{mensagem.texto}</span>
        </div>
      )}

      {mostrarPagar && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Data do pagamento *</p>
          <input
            type="date"
            className="input"
            value={dataPagamento}
            onChange={(evento) => setDataPagamento(evento.target.value)}
          />
          <p className="label">Forma de pagamento</p>
          <select className="input" value={formaPagamento} onChange={(evento) => setFormaPagamento(evento.target.value)}>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="PIX">PIX</option>
            <option value="CARTAO_DEBITO">Cartão de débito</option>
            <option value="CARTAO_CREDITO">Cartão de crédito</option>
            <option value="BOLETO">Boleto</option>
            <option value="TRANSFERENCIA">Transferência</option>
            <option value="OUTRO">Outro</option>
          </select>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={confirmarPagamento}>
              {pendente ? <span className="spinner" /> : "Confirmar pagamento"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMostrarPagar(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {mostrarCancelar && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Motivo do cancelamento *</p>
          <textarea
            className="input"
            rows={2}
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Ex.: lançamento duplicado, erro de valor..."
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={confirmarCancelamento}>
              {pendente ? <span className="spinner" /> : "Confirmar cancelamento"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMostrarCancelar(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
