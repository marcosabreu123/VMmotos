"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FornecedorAutocomplete } from "@/components/FornecedorAutocomplete";
import { ProdutoAutocomplete, type ProdutoBusca } from "@/components/ProdutoAutocomplete";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";
import { registrarEntradaEstoqueAction } from "./actions";
import { nicho } from "@/config/nicho";

type ItemLocal = {
  produtoId: string;
  nome: string;
  tipoVenda: "UNIDADE" | "FRACIONADO";
  quantidade: number;
  custoUnitarioStr: string;
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function EntradaEstoqueForm({ produtoInicial }: { produtoInicial?: ProdutoBusca }) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [fornecedor, setFornecedor] = useState<{ id: string; nome: string } | null>(null);
  const [dataEntrada, setDataEntrada] = useState(hojeISO());
  const [itens, setItens] = useState<ItemLocal[]>(
    produtoInicial
      ? [
          {
            produtoId: produtoInicial.id,
            nome: produtoInicial.nome,
            tipoVenda: produtoInicial.tipoVenda,
            quantidade: 1,
            custoUnitarioStr: "",
          },
        ]
      : []
  );
  const [valorFreteStr, setValorFreteStr] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const quantidadeTotal = useMemo(() => itens.reduce((soma, item) => soma + item.quantidade, 0), [itens]);
  const freteRateado = useMemo(() => {
    const frete = reaisParaCentavos(valorFreteStr || "0");
    if (frete <= 0 || quantidadeTotal <= 0) return 0;
    return Math.round(frete / quantidadeTotal);
  }, [valorFreteStr, quantidadeTotal]);

  const total = useMemo(
    () =>
      itens.reduce((soma, item) => soma + reaisParaCentavos(item.custoUnitarioStr || "0") * item.quantidade, 0) +
      reaisParaCentavos(valorFreteStr || "0"),
    [itens, valorFreteStr]
  );

  function adicionarProduto(produto: ProdutoBusca) {
    setMensagem(null);
    setItens((atual) => {
      if (atual.some((item) => item.produtoId === produto.id)) return atual;
      return [
        ...atual,
        { produtoId: produto.id, nome: produto.nome, tipoVenda: produto.tipoVenda, quantidade: 1, custoUnitarioStr: "" },
      ];
    });
  }

  function removerItem(produtoId: string) {
    setItens((atual) => atual.filter((item) => item.produtoId !== produtoId));
  }

  function atualizarQuantidade(produtoId: string, valor: number) {
    setItens((atual) =>
      atual.map((item) => (item.produtoId === produtoId ? { ...item, quantidade: Math.max(0, valor) } : item))
    );
  }

  function atualizarCusto(produtoId: string, valor: string) {
    setItens((atual) => atual.map((item) => (item.produtoId === produtoId ? { ...item, custoUnitarioStr: valor } : item)));
  }

  function salvar() {
    if (itens.length === 0) {
      setMensagem("Adicione ao menos um produto à entrada.");
      return;
    }
    if (itens.some((item) => item.quantidade <= 0)) {
      setMensagem("Informe uma quantidade válida para cada produto.");
      return;
    }
    if (itens.some((item) => reaisParaCentavos(item.custoUnitarioStr || "0") <= 0)) {
      setMensagem("Informe o custo unitário de cada produto.");
      return;
    }

    setMensagem(null);
    iniciarTransicao(async () => {
      const resultado = await registrarEntradaEstoqueAction({
        fornecedorId: fornecedor?.id ?? null,
        dataEntrada: dataEntrada || null,
        itens: itens.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          custoUnitario: reaisParaCentavos(item.custoUnitarioStr || "0"),
        })),
        valorFrete: reaisParaCentavos(valorFreteStr || "0"),
        observacoes: observacoes || null,
      });

      if (!resultado.ok) {
        setMensagem(resultado.erro);
        return;
      }
      router.push("/estoque");
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
        <p className="label">Produtos *</p>
        <ProdutoAutocomplete onSelecionar={adicionarProduto} placeholder="Buscar produto para adicionar à entrada..." />

        {itens.length === 0 ? (
          <p className="state-empty">Nenhum produto adicionado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {itens.map((item) => (
              <li
                key={item.produtoId}
                className="flex flex-wrap items-center gap-3 border-b pb-3"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="flex-1 font-medium">{item.nome}</span>
                <label className="flex items-center gap-1 text-sm" style={{ color: "var(--muted)" }}>
                  {item.tipoVenda === "FRACIONADO" ? `Qtd (${nicho.atributos.medida.unidade})` : "Qtd"}
                  <input
                    type="number"
                    min={1}
                    className="input"
                    style={{ width: 70 }}
                    value={item.quantidade}
                    onChange={(evento) => atualizarQuantidade(item.produtoId, Number(evento.target.value) || 0)}
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
                    onChange={(evento) => atualizarCusto(item.produtoId, evento.target.value)}
                  />
                </label>
                <span className="w-24 text-right font-semibold">
                  {centavosParaReais(reaisParaCentavos(item.custoUnitarioStr || "0") * item.quantidade)}
                </span>
                <button type="button" className="btn btn-outline" onClick={() => removerItem(item.produtoId)}>
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
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
          />
          {freteRateado > 0 && (
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {centavosParaReais(freteRateado)} de frete por unidade, igual para todos os produtos desta entrada.
            </p>
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
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {itens.length} produto(s) · {quantidadeTotal} un. no total
        </p>
        <div className="resumo-total">
          <span className="label-caps">Total da entrada</span>
          <span className="resumo-total-valor">{centavosParaReais(total)}</span>
        </div>
      </div>

      {mensagem && (
        <p className="state-error" role="alert">
          {mensagem}
        </p>
      )}

      <button type="button" className="btn btn-primary btn-block btn-lg" disabled={pendente} onClick={salvar}>
        {pendente ? <span className="spinner" /> : "Salvar entrada"}
      </button>
    </div>
  );
}
