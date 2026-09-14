"use client";

import { useRef, useState } from "react";
import { centavosParaReais } from "@/lib/money";
import { nicho } from "@/config/nicho";
import { lerFotoPedidoAction, type ItemCasado } from "./lerFoto";

/**
 * Lê a foto do pedido do fornecedor e devolve os itens para a entrada.
 *
 * O que a IA extrai NUNCA vai direto para o estoque: aparece numa lista de
 * conferência, item a item, com o que ela leu na nota ao lado da peça que ela
 * casou no catálogo. O dono desmarca o que estiver errado e só então usa.
 *
 * Isso não é excesso de zelo: nota amassada, carbonada ou escrita à mão erra,
 * e custo de entrada errado contamina o lucro de todas as vendas daquele lote.
 */

export type ItemParaEntrada = {
  produtoId: string;
  nome: string;
  tipoVenda: "UNIDADE" | "FRACIONADO";
  quantidade: number;
  custoUnitarioStr: string;
};

function centavosParaCampo(c: number): string {
  return (c / 100).toFixed(2).replace(".", ",");
}

export function LerFotoPedido({
  aoUsar,
  aoDefinirFrete,
}: {
  aoUsar: (itens: ItemParaEntrada[]) => void;
  aoDefinirFrete: (freteStr: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    itens: ItemCasado[];
    frete: number;
    fornecedorLido: string | null;
    observacao: string | null;
  } | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());

  async function enviar(arquivo: File) {
    setErro(null);
    setResultado(null);
    setLendo(true);

    const dados = new FormData();
    dados.append("foto", arquivo);
    const r = await lerFotoPedidoAction(dados);

    setLendo(false);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }

    setResultado({ itens: r.itens, frete: r.frete, fornecedorLido: r.fornecedorLido, observacao: r.observacao });
    // Já vêm marcados só os que casaram com o catálogo — item sem peça
    // correspondente não tem como entrar no estoque.
    setMarcados(new Set(r.itens.map((it, i) => (it.produto ? i : -1)).filter((i) => i >= 0)));
  }

  function usar() {
    if (!resultado) return;
    const escolhidos: ItemParaEntrada[] = [];
    for (const [i, item] of resultado.itens.entries()) {
      if (!marcados.has(i) || !item.produto) continue;
      escolhidos.push({
        produtoId: item.produto.id,
        nome: item.produto.nome,
        tipoVenda: item.produto.tipoVenda,
        quantidade: item.quantidade,
        custoUnitarioStr: item.custoUnitario > 0 ? centavosParaCampo(item.custoUnitario) : "",
      });
    }
    aoUsar(escolhidos);
    if (resultado.frete > 0) aoDefinirFrete(centavosParaCampo(resultado.frete));
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const naoCasaram = resultado ? resultado.itens.filter((i) => !i.produto).length : 0;
  const semCusto = resultado
    ? resultado.itens.filter((i, idx) => marcados.has(idx) && i.custoUnitario === 0).length
    : 0;

  return (
    <div className="bloco-foto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="label">Ler foto do pedido</p>
          <p className="ajuda">
            Fotografe a nota do fornecedor e o sistema lista as {nicho.termos.produto.plural.toLowerCase()} para você conferir.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          disabled={lendo}
          onClick={() => inputRef.current?.click()}
        >
          {lendo ? <span className="spinner" /> : "Escolher foto"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) enviar(arquivo);
        }}
      />

      {erro && (
        <p className="badge badge-danger mt-3" role="alert">
          {erro}
        </p>
      )}

      {resultado && (
        <div className="mt-4">
          <p className="label-caps mb-2">
            Confira antes de usar — {resultado.itens.length} item(ns) lidos
          </p>

          {resultado.fornecedorLido && (
            <p className="ajuda">Fornecedor na nota: {resultado.fornecedorLido}</p>
          )}
          {resultado.observacao && (
            <p className="badge badge-warning mt-2">{resultado.observacao}</p>
          )}

          <ul className="mt-3 flex flex-col gap-2">
            {resultado.itens.map((item, i) => (
              <li key={i} className={`linha-lida${item.produto ? "" : " linha-lida-sem-peca"}`}>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={marcados.has(i)}
                    disabled={!item.produto}
                    onChange={(e) => {
                      const novo = new Set(marcados);
                      if (e.target.checked) novo.add(i);
                      else novo.delete(i);
                      setMarcados(novo);
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {item.quantidade}× {item.produto ? item.produto.nome : item.descricaoLida}
                    </span>
                    <span className="celula-sub">
                      {item.produto ? (
                        <>
                          na nota: &quot;{item.descricaoLida}&quot; · {item.produto.sku}
                        </>
                      ) : (
                        <>não achei essa peça no cadastro — cadastre antes ou lance à mão</>
                      )}
                    </span>
                  </span>
                  <span className="text-right">
                    {item.custoUnitario > 0 ? (
                      <strong>{centavosParaReais(item.custoUnitario)}</strong>
                    ) : (
                      <span style={{ color: "var(--warning)" }}>custo ilegível</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {resultado.frete > 0 && (
            <p className="ajuda mt-2">Frete na nota: {centavosParaReais(resultado.frete)} — será preenchido.</p>
          )}
          {naoCasaram > 0 && (
            <p className="ajuda">
              {naoCasaram} item(ns) sem peça correspondente ficam de fora. Cadastre a peça e leia a foto de novo, ou lance à mão.
            </p>
          )}
          {semCusto > 0 && (
            <p className="badge badge-warning mt-2">
              {semCusto} item(ns) sem custo legível — você precisa digitar o valor antes de salvar.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={usar} disabled={marcados.size === 0}>
              Usar {marcados.size} item(ns)
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setResultado(null)}>
              Descartar leitura
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
