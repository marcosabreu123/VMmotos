"use client";

import { useMemo, useState, useTransition } from "react";
import { unidadeEstoque, type TipoVendaLiteral } from "@/lib/unidadeEstoque";
import { aplicarContagemInventarioAction } from "./actions";

export type LoteContagem = {
  id: string;
  produtoNome: string;
  numero: string;
  tipoVenda: TipoVendaLiteral;
  quantidadeAtualVenda: number;
  quantidadeAtualDemonstracao: number;
};

type Delta = { loteId: string; produtoNome: string; pool: "VENDA" | "DEMONSTRACAO"; delta: number; unidade: "ml" | "un." };

export function InventarioForm({ lotes }: { lotes: LoteContagem[] }) {
  const [contagem, setContagem] = useState<Record<string, { venda: string; demonstracao: string }>>(
    Object.fromEntries(
      lotes.map((lote) => [
        lote.id,
        { venda: String(lote.quantidadeAtualVenda), demonstracao: String(lote.quantidadeAtualDemonstracao) },
      ])
    )
  );
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Delta[] | null>(null);

  function atualizarCampo(loteId: string, campo: "venda" | "demonstracao", valor: string) {
    setResumo(null);
    setContagem((atual) => ({ ...atual, [loteId]: { ...atual[loteId], [campo]: valor } }));
  }

  const deltas = useMemo<Delta[]>(() => {
    const linhas: Delta[] = [];
    for (const lote of lotes) {
      const valores = contagem[lote.id];
      const unidade = unidadeEstoque(lote.tipoVenda);
      const deltaVenda = (Number(valores.venda) || 0) - lote.quantidadeAtualVenda;
      const deltaDemonstracao = (Number(valores.demonstracao) || 0) - lote.quantidadeAtualDemonstracao;
      if (deltaVenda !== 0) {
        linhas.push({ loteId: lote.id, produtoNome: lote.produtoNome, pool: "VENDA", delta: deltaVenda, unidade });
      }
      if (deltaDemonstracao !== 0) {
        linhas.push({ loteId: lote.id, produtoNome: lote.produtoNome, pool: "DEMONSTRACAO", delta: deltaDemonstracao, unidade });
      }
    }
    return linhas;
  }, [contagem, lotes]);

  function aplicar() {
    if (deltas.length === 0) {
      setMensagem("Nenhuma alteração para aplicar.");
      return;
    }
    setMensagem(null);
    iniciarTransicao(async () => {
      const itens = deltas.map((d) => ({
        loteId: d.loteId,
        pool: d.pool,
        quantidadeContada: d.pool === "VENDA" ? Number(contagem[d.loteId].venda) : Number(contagem[d.loteId].demonstracao),
      }));
      const resultado = await aplicarContagemInventarioAction(itens);
      if (!resultado.ok) {
        setMensagem(resultado.erro);
        return;
      }
      setResumo(deltas);
    });
  }

  if (lotes.length === 0) {
    return <p className="state-empty">Nenhum lote ativo para contar.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3">
        {lotes.map((lote) => {
          const unidade = unidadeEstoque(lote.tipoVenda);
          return (
            <li key={lote.id} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{lote.produtoNome}</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Lote {lote.numero}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
                Venda ({unidade})
                <input
                  type="number"
                  min={0}
                  className="input"
                  style={{ width: 90 }}
                  value={contagem[lote.id].venda}
                  onChange={(evento) => atualizarCampo(lote.id, "venda", evento.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
                Demonstracao ({unidade})
                <input
                  type="number"
                  min={0}
                  className="input"
                  style={{ width: 90 }}
                  value={contagem[lote.id].demonstracao}
                  onChange={(evento) => atualizarCampo(lote.id, "demonstracao", evento.target.value)}
                />
              </label>
            </li>
          );
        })}
      </ul>

      {deltas.length > 0 && !resumo && (
        <div className="card p-4">
          <p className="label-caps mb-2">Ajustes a aplicar</p>
          <ul className="flex flex-col gap-1 text-sm">
            {deltas.map((d, indice) => (
              <li key={`${d.loteId}-${d.pool}-${indice}`}>
                {d.produtoNome} · {d.pool === "VENDA" ? "venda" : "demonstracao"} ·{" "}
                {d.delta > 0 ? `+${d.delta}` : d.delta} {d.unidade}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mensagem && (
        <p className="state-error" role="alert">
          {mensagem}
        </p>
      )}

      {resumo && (
        <div className="state-success" role="status">
          <span>
            Contagem aplicada: {resumo.length} ajuste(s) registrado(s) com sucesso.
          </span>
        </div>
      )}

      <button type="button" className="btn btn-primary btn-block" disabled={pendente} onClick={aplicar}>
        {pendente ? <span className="spinner" /> : "Aplicar contagem"}
      </button>
    </div>
  );
}
