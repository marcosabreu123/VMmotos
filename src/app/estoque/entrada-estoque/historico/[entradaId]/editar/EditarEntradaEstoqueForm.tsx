"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FornecedorAutocomplete } from "@/components/FornecedorAutocomplete";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";
import { atualizarEntradaEstoqueAction } from "./actions";
import { nicho } from "@/config/nicho";

type ItemLocal = {
  id: string;
  produtoNome: string;
  tipoVenda: "UNIDADE" | "FRACIONADO";
  quantidade: number;
  custoUnitarioStr: string;
  bloqueado: boolean;
};

export type EntradaParaEdicao = {
  id: string;
  fornecedor: { id: string; nome: string } | null;
  dataEntrada: string; // "YYYY-MM-DD"
  observacoes: string | null;
  valorFrete: number; // centavos
  itens: ItemLocal[];
};

export function EditarEntradaEstoqueForm({ entrada }: { entrada: EntradaParaEdicao }) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [fornecedor, setFornecedor] = useState<{ id: string; nome: string } | null>(entrada.fornecedor);
  const [dataEntrada, setDataEntrada] = useState(entrada.dataEntrada);
  const [observacoes, setObservacoes] = useState(entrada.observacoes ?? "");
  const [valorFreteStr, setValorFreteStr] = useState(
    entrada.valorFrete > 0 ? (entrada.valorFrete / 100).toFixed(2).replace(".", ",") : ""
  );
  const [itens, setItens] = useState<ItemLocal[]>(entrada.itens);

  const algumBloqueado = itens.some((item) => item.bloqueado);

  function atualizarQuantidade(id: string, valor: number) {
    setItens((atual) => atual.map((item) => (item.id === id ? { ...item, quantidade: Math.max(0, valor) } : item)));
  }

  function atualizarCusto(id: string, valor: string) {
    setItens((atual) => atual.map((item) => (item.id === id ? { ...item, custoUnitarioStr: valor } : item)));
  }

  const quantidadeTotal = useMemo(() => itens.reduce((soma, item) => soma + item.quantidade, 0), [itens]);
  const freteRateado = useMemo(() => {
    const frete = reaisParaCentavos(valorFreteStr || "0");
    if (frete <= 0 || quantidadeTotal <= 0) return 0;
    return Math.round(frete / quantidadeTotal);
  }, [valorFreteStr, quantidadeTotal]);

  function salvar() {
    const editaveis = itens.filter((item) => !item.bloqueado);
    if (editaveis.some((item) => item.quantidade <= 0)) {
      setMensagem("Informe uma quantidade válida para cada produto.");
      return;
    }
    if (editaveis.some((item) => reaisParaCentavos(item.custoUnitarioStr || "0") <= 0)) {
      setMensagem("Informe o custo unitário de cada produto.");
      return;
    }

    setMensagem(null);
    iniciarTransicao(async () => {
      const novoFrete = reaisParaCentavos(valorFreteStr || "0");
      const resultado = await atualizarEntradaEstoqueAction(entrada.id, {
        fornecedorId: fornecedor?.id ?? null,
        dataEntrada,
        observacoes: observacoes || null,
        valorFrete: novoFrete !== entrada.valorFrete ? novoFrete : null,
        itens: editaveis.map((item) => ({
          id: item.id,
          quantidade: item.quantidade,
          custoUnitario: reaisParaCentavos(item.custoUnitarioStr || "0"),
        })),
      });

      if (!resultado.ok) {
        setMensagem(resultado.erro);
        return;
      }
      router.push("/estoque/entrada-estoque/historico");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col gap-3 p-5">
        <p className="label">Fornecedor</p>
        {fornecedor ? (
          <div className="flex items-center justify-between">
            <span className="font-medium">{fornecedor.nome}</span>
            <button type="button" className="btn btn-outline" onClick={() => setFornecedor(null)}>
              Trocar
            </button>
          </div>
        ) : (
          <FornecedorAutocomplete onSelecionar={(f) => setFornecedor({ id: f.id, nome: f.nome })} placeholder="Opcional — buscar fornecedor..." />
        )}

        <div className="mt-2">
          <label className="label" htmlFor="dataEntrada">
            Data da entrada
          </label>
          <input
            id="dataEntrada"
            type="date"
            className="input"
            value={dataEntrada}
            onChange={(evento) => setDataEntrada(evento.target.value)}
          />
        </div>
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <p className="label">Produtos</p>
        <ul className="flex flex-col gap-3">
          {itens.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-3 border-b pb-3"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="flex-1 font-medium">{item.produtoNome}</span>
              {item.bloqueado ? (
                <>
                  <span className="badge">{item.quantidade} un.</span>
                  <span className="badge">{centavosParaReais(reaisParaCentavos(item.custoUnitarioStr || "0"))}</span>
                  <span className="badge badge-danger">Já vendido — não editável</span>
                </>
              ) : (
                <>
                  <label className="flex items-center gap-1 text-sm" style={{ color: "var(--muted)" }}>
                    {item.tipoVenda === "FRACIONADO" ? `Qtd (${nicho.atributos.medida.unidade})` : "Qtd"}
                    <input
                      type="number"
                      min={1}
                      className="input"
                      style={{ width: 70 }}
                      value={item.quantidade}
                      onChange={(evento) => atualizarQuantidade(item.id, Number(evento.target.value) || 0)}
                    />
                  </label>
                  <label className="flex items-center gap-1 text-sm" style={{ color: "var(--muted)" }}>
                    {item.tipoVenda === "FRACIONADO" ? "Custo/ml (R$)" : "Custo unit. (R$)"}
                    <input
                      className="input"
                      style={{ width: 100 }}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={item.custoUnitarioStr}
                      onChange={(evento) => atualizarCusto(item.id, evento.target.value)}
                    />
                  </label>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <div>
          <label className="label" htmlFor="valorFrete">
            Frete total (R$)
          </label>
          <input
            id="valorFrete"
            className="input"
            inputMode="decimal"
            placeholder="0,00"
            value={valorFreteStr}
            onChange={(evento) => setValorFreteStr(evento.target.value)}
            disabled={algumBloqueado}
          />
          {algumBloqueado ? (
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              O frete não pode ser alterado porque um ou mais produtos desta entrada já foram vendidos.
            </p>
          ) : (
            freteRateado > 0 && (
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {centavosParaReais(freteRateado)} de frete por unidade, igual para todos os produtos desta entrada.
              </p>
            )
          )}
        </div>
        <div>
          <label className="label" htmlFor="observacoes">
            Observação
          </label>
          <textarea
            id="observacoes"
            className="input"
            rows={3}
            placeholder="Opcional"
            value={observacoes}
            onChange={(evento) => setObservacoes(evento.target.value)}
          />
        </div>
      </div>

      {mensagem && (
        <p className="state-error" role="alert">
          {mensagem}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-lg" disabled={pendente} onClick={salvar}>
          {pendente ? <span className="spinner" /> : "Salvar alterações"}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => router.push("/estoque/entrada-estoque/historico")}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
