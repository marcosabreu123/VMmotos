"use client";

import { useState, useTransition } from "react";
import { criarTipoServicoAction } from "@/app/vendas/oficinaActions";
import { arquivarTipoServicoAction } from "./actions";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";

/**
 * Catálogo de tipos de serviço.
 *
 * Existe aqui, fora da venda, porque o dono pediu poder organizar a lista com
 * calma — dentro da venda o cadastro é atalho para não travar o atendimento,
 * não lugar de arrumar o catálogo.
 */
export function TiposServico({
  iniciais,
  podeEditar,
}: {
  iniciais: Array<{ id: string; nome: string; valorSugerido: number | null }>;
  podeEditar: boolean;
}) {
  const [tipos, setTipos] = useState(iniciais);
  const [novo, setNovo] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function adicionar() {
    const nome = novo.trim();
    if (!nome) return;

    setErro(null);
    iniciar(async () => {
      const centavos = novoValor.trim() ? reaisParaCentavos(novoValor) : null;
      const r = await criarTipoServicoAction(nome, centavos);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      const semEste = tipos.filter((t) => t.id !== r.tipo.id);
      setTipos([...semEste, r.tipo].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovo("");
      setNovoValor("");
    });
  }

  function arquivar(id: string) {
    setErro(null);
    iniciar(async () => {
      const r = await arquivarTipoServicoAction(id);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setTipos(tipos.filter((t) => t.id !== id));
    });
  }

  return (
    <section className="mb-8">
      <h2 className="label-caps mb-3">Tipos de serviço</h2>

      {podeEditar && (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div style={{ flex: "1 1 240px" }}>
            <input
              className="input"
              placeholder="Ex.: Troca de relação"
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionar();
                }
              }}
              aria-label="Novo tipo de serviço"
            />
          </div>
          <div style={{ flex: "0 1 150px" }}>
            <input
              className="input"
              inputMode="decimal"
              placeholder="Valor (opcional)"
              value={novoValor}
              onChange={(e) => setNovoValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionar();
                }
              }}
              aria-label="Valor sugerido do serviço"
            />
          </div>
          <button type="button" className="btn btn-primary" onClick={adicionar} disabled={ocupado || !novo.trim()}>
            {ocupado ? <span className="spinner" /> : "Adicionar"}
          </button>
        </div>
      )}

      {tipos.length === 0 ? (
        <p className="state-empty">
          Nenhum tipo cadastrado. Sem problema: dá para descrever o serviço na
          hora da venda e cadastrar depois o que se repetir.
        </p>
      ) : (
        <ul className="lista-chips">
          {tipos.map((t) => (
            <li key={t.id} className="chip-tipo">
              <span>
                {t.nome}
                {t.valorSugerido !== null && (
                  <span style={{ color: "var(--accent)" }}> · {centavosParaReais(t.valorSugerido)}</span>
                )}
              </span>
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => arquivar(t.id)}
                  disabled={ocupado}
                  aria-label={`Remover ${t.nome} da lista`}
                  title="Remove da lista; serviços já lançados não mudam"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <p className="badge badge-danger mt-3" role="alert">
          {erro}
        </p>
      )}

      <p className="ajuda mt-3">
        O valor é opcional: se preencher, ele já vem pronto na venda — e
        continua editável lá, para quando o serviço for negociado por outro
        preço. Cadastrar de novo um nome que já existe atualiza o valor dele.
        Remover um tipo daqui não altera serviço nenhum já lançado.
      </p>
    </section>
  );
}
