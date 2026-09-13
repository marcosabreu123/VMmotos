"use client";

import { useMemo, useState, useTransition } from "react";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";
import { calcularMargem, type LinhaPreco } from "@/lib/precos";
import { salvarPrecosAction } from "./actions";

/**
 * Edição de preços de todas as peças numa tela só.
 *
 * O dono digita em reais ("12,50"), não em centavos — o valor fica como texto
 * enquanto ele edita e só vira centavo na hora de salvar. Converter a cada
 * tecla atrapalharia quem está no meio de digitar "12,5".
 *
 * Nada é gravado a cada campo: ele mexe no que quiser e salva uma vez só.
 * O contador de pendências existe para ele não sair da tela achando que
 * salvou.
 */

type Rascunho = { custo: string; venda: string };

function centavosParaCampo(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

export function TabelaPrecos({ linhas }: { linhas: LinhaPreco[] }) {
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>(() =>
    Object.fromEntries(
      linhas.map((l) => [
        l.id,
        { custo: centavosParaCampo(l.precoCustoRef), venda: centavosParaCampo(l.precoVenda) },
      ])
    )
  );
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, iniciarSalvamento] = useTransition();

  const alteradas = useMemo(
    () =>
      linhas.filter((l) => {
        const r = rascunhos[l.id];
        if (!r) return false;
        return (
          reaisParaCentavos(r.custo) !== l.precoCustoRef ||
          reaisParaCentavos(r.venda) !== l.precoVenda
        );
      }),
    [linhas, rascunhos]
  );

  function editar(id: string, campo: keyof Rascunho, valor: string) {
    setRascunhos((atual) => ({ ...atual, [id]: { ...atual[id], [campo]: valor } }));
    setMensagem(null);
  }

  function salvar() {
    if (alteradas.length === 0) return;

    iniciarSalvamento(async () => {
      const resultado = await salvarPrecosAction(
        alteradas.map((l) => ({
          produtoId: l.id,
          precoCustoRef: reaisParaCentavos(rascunhos[l.id].custo),
          precoVenda: reaisParaCentavos(rascunhos[l.id].venda),
        }))
      );

      if (resultado.ok) {
        setMensagem({
          tipo: "ok",
          texto:
            resultado.alteradas === 1
              ? "1 peça atualizada."
              : `${resultado.alteradas} peças atualizadas.`,
        });
      } else {
        setMensagem({ tipo: "erro", texto: resultado.erro });
      }
    });
  }

  function desfazer() {
    setRascunhos(
      Object.fromEntries(
        linhas.map((l) => [
          l.id,
          { custo: centavosParaCampo(l.precoCustoRef), venda: centavosParaCampo(l.precoVenda) },
        ])
      )
    );
    setMensagem(null);
  }

  if (linhas.length === 0) {
    return <p className="state-empty">Nenhuma peça encontrada.</p>;
  }

  return (
    <>
      <div className="tabela-precos-wrap">
        <table className="tabela-precos">
          <thead>
            <tr>
              <th>Peça</th>
              <th className="col-num">Custo</th>
              <th className="col-num">Venda</th>
              <th className="col-num">Lucro</th>
              <th className="col-num">Margem</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => {
              const r = rascunhos[linha.id];
              const custo = reaisParaCentavos(r.custo);
              const venda = reaisParaCentavos(r.venda);
              const lucro = venda - custo;
              const margem = calcularMargem(custo, venda);
              const mudou = custo !== linha.precoCustoRef || venda !== linha.precoVenda;

              return (
                <tr key={linha.id} className={mudou ? "linha-alterada" : undefined}>
                  <td>
                    <span className="font-medium">{linha.nome}</span>
                    <span className="celula-sub">
                      {linha.marca} · {linha.categoria} · {linha.sku}
                    </span>
                  </td>
                  <td className="col-num">
                    <input
                      className="input-preco"
                      inputMode="decimal"
                      value={r.custo}
                      onChange={(e) => editar(linha.id, "custo", e.target.value)}
                      aria-label={`Custo de ${linha.nome}`}
                    />
                  </td>
                  <td className="col-num">
                    <input
                      className="input-preco"
                      inputMode="decimal"
                      value={r.venda}
                      onChange={(e) => editar(linha.id, "venda", e.target.value)}
                      aria-label={`Preço de venda de ${linha.nome}`}
                    />
                  </td>
                  <td className="col-num">
                    <span style={{ color: lucro < 0 ? "var(--danger)" : undefined }}>
                      {centavosParaReais(lucro)}
                    </span>
                  </td>
                  <td className="col-num">
                    {margem === null ? (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    ) : (
                      <span style={{ color: margem < 0 ? "var(--danger)" : undefined }}>
                        {margem.toFixed(1)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Barra fixa: numa tabela longa o botão de salvar não pode ficar só lá
          embaixo, fora da vista de quem está editando no meio da lista. */}
      <div className="barra-salvar">
        <span className="barra-salvar-info">
          {alteradas.length === 0
            ? "Nenhuma alteração"
            : alteradas.length === 1
              ? "1 peça alterada"
              : `${alteradas.length} peças alteradas`}
        </span>

        {mensagem && (
          <span
            role="status"
            className="barra-salvar-msg"
            style={{ color: mensagem.tipo === "ok" ? "var(--success)" : "var(--danger)" }}
          >
            {mensagem.texto}
          </span>
        )}

        {alteradas.length > 0 && (
          <button type="button" className="btn btn-outline" onClick={desfazer} disabled={salvando}>
            Desfazer
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={salvar}
          disabled={salvando || alteradas.length === 0}
        >
          {salvando ? <span className="spinner" /> : "Salvar alterações"}
        </button>
      </div>
    </>
  );
}
