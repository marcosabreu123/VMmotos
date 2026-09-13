"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FornecedorAutocomplete } from "@/components/FornecedorAutocomplete";
import { ProdutoAutocomplete, type ProdutoBusca } from "@/components/ProdutoAutocomplete";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";
import { criarPedidoAction, atualizarPedidoAction } from "../actions";
import { nicho, rotuloDemonstracao } from "@/config/nicho";

type ItemLocal = {
  produtoId: string;
  nome: string;
  tipoVenda: "UNIDADE" | "FRACIONADO";
  quantidade: number;
  quantidadeDemonstracao: number;
  custoUnitarioStr: string;
};

export type ItemPedidoInicial = {
  produtoId: string;
  nome: string;
  tipoVenda: "UNIDADE" | "FRACIONADO";
  quantidade: number;
  quantidadeDemonstracao: number;
  custoUnitario: number; // centavos
};

export type ValoresIniciaisPedido = {
  fornecedor: { id: string; nome: string };
  itens: ItemPedidoInicial[];
  valorFrete: number; // centavos
  observacoes: string | null;
};

export function PedidoForm({
  modo,
  pedidoId,
  valoresIniciais,
}: {
  modo: "criar" | "editar";
  pedidoId?: string;
  valoresIniciais?: ValoresIniciaisPedido;
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [fornecedor, setFornecedor] = useState<{ id: string; nome: string } | null>(
    valoresIniciais?.fornecedor ?? null
  );
  const [itens, setItens] = useState<ItemLocal[]>(
    valoresIniciais?.itens.map((item) => ({
      produtoId: item.produtoId,
      nome: item.nome,
      tipoVenda: item.tipoVenda,
      quantidade: item.quantidade,
      quantidadeDemonstracao: item.quantidadeDemonstracao,
      custoUnitarioStr: (item.custoUnitario / 100).toFixed(2).replace(".", ","),
    })) ?? []
  );
  const [valorFreteStr, setValorFreteStr] = useState(
    valoresIniciais && valoresIniciais.valorFrete > 0
      ? (valoresIniciais.valorFrete / 100).toFixed(2).replace(".", ",")
      : ""
  );
  const [observacoes, setObservacoes] = useState(valoresIniciais?.observacoes ?? "");

  const total = useMemo(
    () =>
      itens.reduce(
        (soma, item) =>
          soma + reaisParaCentavos(item.custoUnitarioStr || "0") * (item.quantidade + item.quantidadeDemonstracao),
        0
      ) + reaisParaCentavos(valorFreteStr || "0"),
    [itens, valorFreteStr]
  );

  function adicionarProduto(produto: ProdutoBusca) {
    setMensagem(null);
    setItens((atual) => {
      if (atual.some((item) => item.produtoId === produto.id)) return atual;
      return [
        ...atual,
        {
          produtoId: produto.id,
          nome: produto.nome,
          tipoVenda: produto.tipoVenda,
          quantidade: 1,
          quantidadeDemonstracao: 0,
          custoUnitarioStr: "",
        },
      ];
    });
  }

  function removerItem(produtoId: string) {
    setItens((atual) => atual.filter((item) => item.produtoId !== produtoId));
  }

  function atualizarQuantidade(produtoId: string, campo: "quantidade" | "quantidadeDemonstracao", valor: number) {
    setItens((atual) =>
      atual.map((item) => (item.produtoId === produtoId ? { ...item, [campo]: Math.max(0, valor) } : item))
    );
  }

  function atualizarCusto(produtoId: string, valor: string) {
    setItens((atual) => atual.map((item) => (item.produtoId === produtoId ? { ...item, custoUnitarioStr: valor } : item)));
  }

  function montarDados() {
    return {
      fornecedorId: fornecedor!.id,
      valorFrete: reaisParaCentavos(valorFreteStr || "0"),
      observacoes: observacoes || null,
      itens: itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        quantidadeDemonstracao: item.quantidadeDemonstracao,
        custoUnitario: reaisParaCentavos(item.custoUnitarioStr || "0"),
      })),
    };
  }

  function salvar(enviarAoSalvar: boolean) {
    if (!fornecedor) {
      setMensagem("Selecione o fornecedor.");
      return;
    }
    if (itens.length === 0) {
      setMensagem("Adicione ao menos um item ao pedido.");
      return;
    }
    if (itens.some((item) => item.quantidade <= 0)) {
      setMensagem("Informe uma quantidade válida para cada item.");
      return;
    }
    if (itens.some((item) => reaisParaCentavos(item.custoUnitarioStr || "0") <= 0)) {
      setMensagem("Informe o custo unitário de cada item.");
      return;
    }

    setMensagem(null);
    iniciarTransicao(async () => {
      const dados = montarDados();

      if (modo === "editar" && pedidoId) {
        const resultado = await atualizarPedidoAction(pedidoId, dados);
        if (!resultado.ok) {
          setMensagem(resultado.erro);
          return;
        }
        router.push(`/compras/${pedidoId}`);
        return;
      }

      const resultado = await criarPedidoAction(dados, enviarAoSalvar);
      if (!resultado.ok) {
        setMensagem(resultado.erro);
        return;
      }
      router.push(`/compras/${resultado.pedidoId}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex flex-col gap-3 p-5">
        <p className="label">Fornecedor *</p>
        {fornecedor ? (
          <div className="flex items-center justify-between">
            <span className="font-medium">{fornecedor.nome}</span>
            <button type="button" className="btn btn-outline" onClick={() => setFornecedor(null)}>
              Trocar
            </button>
          </div>
        ) : (
          <FornecedorAutocomplete onSelecionar={(f) => setFornecedor({ id: f.id, nome: f.nome })} />
        )}
      </div>

      <div className="card flex flex-col gap-4 p-5">
        <p className="label">Itens do pedido *</p>
        <ProdutoAutocomplete onSelecionar={adicionarProduto} placeholder="Buscar produto para adicionar ao pedido..." />

        {itens.length === 0 ? (
          <p className="state-empty">Nenhum item adicionado ainda.</p>
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
                    onChange={(evento) => atualizarQuantidade(item.produtoId, "quantidade", Number(evento.target.value) || 0)}
                  />
                </label>
                <label className="flex items-center gap-1 text-sm" style={{ color: "var(--muted)" }}>
                  {item.tipoVenda === "FRACIONADO" ? `${rotuloDemonstracao} (${nicho.atributos.medida.unidade})` : rotuloDemonstracao}
                  <input
                    type="number"
                    min={0}
                    className="input"
                    style={{ width: 70 }}
                    value={item.quantidadeDemonstracao}
                    onChange={(evento) =>
                      atualizarQuantidade(item.produtoId, "quantidadeDemonstracao", Number(evento.target.value) || 0)
                    }
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
                  {centavosParaReais(
                    reaisParaCentavos(item.custoUnitarioStr || "0") * (item.quantidade + item.quantidadeDemonstracao)
                  )}
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
            Valor do frete (R$)
          </label>
          <input
            id="valorFrete"
            className="input"
            inputMode="decimal"
            placeholder="0,00"
            value={valorFreteStr}
            onChange={(evento) => setValorFreteStr(evento.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="observacoes">
            Observações
          </label>
          <textarea
            id="observacoes"
            className="input"
            rows={3}
            value={observacoes}
            onChange={(evento) => setObservacoes(evento.target.value)}
          />
        </div>
        <div className="resumo-total">
          <span className="label-caps">Total do pedido</span>
          <span className="resumo-total-valor">{centavosParaReais(total)}</span>
        </div>
      </div>

      {mensagem && (
        <p className="state-error" role="alert">
          {mensagem}
        </p>
      )}

      <div className="flex gap-2">
        {modo === "editar" ? (
          <button type="button" className="btn btn-primary" disabled={pendente} onClick={() => salvar(false)}>
            {pendente ? <span className="spinner" /> : "Salvar alterações"}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-outline" disabled={pendente} onClick={() => salvar(false)}>
              {pendente ? <span className="spinner" /> : "Salvar rascunho"}
            </button>
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={() => salvar(true)}>
              {pendente ? <span className="spinner" /> : "Salvar e enviar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
