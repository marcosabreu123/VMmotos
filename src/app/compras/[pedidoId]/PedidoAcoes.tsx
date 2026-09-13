"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  enviarPedidoAction,
  cancelarPedidoAction,
  receberPedidoAction,
  type ItemRecebimentoForm,
} from "../actions";
import { IconCheck } from "@/components/icons";
import type { StatusPedido } from "@prisma/client";

type ItemParaRecebimento = { id: string; produtoNome: string };

export function PedidoAcoes({
  pedidoId,
  status,
  itens,
}: {
  pedidoId: string;
  status: StatusPedido;
  itens: ItemParaRecebimento[];
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);

  const [mostrarCancelar, setMostrarCancelar] = useState(false);
  const [mostrarReceber, setMostrarReceber] = useState(false);
  const [lotes, setLotes] = useState<Record<string, { numeroLote: string; dataValidade: string }>>({});

  function enviar() {
    iniciarTransicao(async () => {
      const resultado = await enviarPedidoAction(pedidoId);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      router.refresh();
    });
  }

  function confirmarCancelamento() {
    iniciarTransicao(async () => {
      const resultado = await cancelarPedidoAction(pedidoId);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      setMostrarCancelar(false);
      router.refresh();
    });
  }

  function confirmarRecebimento() {
    const itensRecebimento: ItemRecebimentoForm[] = itens.map((item) => ({
      itemPedidoId: item.id,
      numeroLote: lotes[item.id]?.numeroLote?.trim() ?? "",
      dataValidade: lotes[item.id]?.dataValidade || null,
    }));

    if (itensRecebimento.some((item) => !item.numeroLote)) {
      setMensagem({ tipo: "erro", texto: "Informe o número do lote para cada item." });
      return;
    }

    iniciarTransicao(async () => {
      const resultado = await receberPedidoAction(pedidoId, itensRecebimento);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      setMostrarReceber(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {status === "RASCUNHO" && (
          <>
            <Link href={`/compras/${pedidoId}/editar`} className="btn btn-outline">
              Editar pedido
            </Link>
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={enviar}>
              {pendente ? <span className="spinner" /> : "Enviar pedido"}
            </button>
          </>
        )}
        {status === "ENVIADO" && (
          <button type="button" className="btn btn-primary" onClick={() => setMostrarReceber(true)}>
            Receber pedido
          </button>
        )}
        {(status === "RASCUNHO" || status === "ENVIADO") && (
          <button type="button" className="btn btn-outline" onClick={() => setMostrarCancelar(true)}>
            Cancelar pedido
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

      {mostrarCancelar && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Ao confirmar, este pedido passa para o status Cancelado. Essa ação não pode ser desfeita.
          </p>
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

      {mostrarReceber && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Informe o lote de recebimento de cada item</p>
          <ul className="flex flex-col gap-3">
            {itens.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3">
                <span className="flex-1 font-medium">{item.produtoNome}</span>
                <input
                  className="input"
                  style={{ width: 160 }}
                  placeholder="Número do lote *"
                  value={lotes[item.id]?.numeroLote ?? ""}
                  onChange={(evento) =>
                    setLotes((atual) => ({
                      ...atual,
                      [item.id]: { ...atual[item.id], numeroLote: evento.target.value },
                    }))
                  }
                />
                <input
                  type="date"
                  className="input"
                  style={{ width: 160 }}
                  value={lotes[item.id]?.dataValidade ?? ""}
                  onChange={(evento) =>
                    setLotes((atual) => ({
                      ...atual,
                      [item.id]: { ...atual[item.id], dataValidade: evento.target.value },
                    }))
                  }
                />
              </li>
            ))}
          </ul>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Ao confirmar, os lotes são criados com o custo real (custo + rateio de frete) e o estoque fica disponível
            para venda. Essa ação não pode ser desfeita.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={confirmarRecebimento}>
              {pendente ? <span className="spinner" /> : "Confirmar recebimento"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMostrarReceber(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
