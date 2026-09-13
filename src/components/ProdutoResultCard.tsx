"use client";

import { centavosParaReais } from "@/lib/money";
import { IconPlus } from "./icons";

export type ProdutoVenda = {
  id: string;
  nome: string;
  marca: string;
  sku: string;
  codigoBarras: string | null;
  medida: number | null;
  precoVenda: number;
  tipoVenda: "UNIDADE" | "FRACIONADO";
  atributoB: string | null;
  fotoPath: string | null;
  estoqueAtual: number;
};

export function ProdutoResultCard({
  produto,
  onAdicionar,
}: {
  produto: ProdutoVenda;
  onAdicionar: (produto: ProdutoVenda) => void;
}) {
  const semEstoque = produto.estoqueAtual <= 0;

  return (
    <div className="card produto-resultado">
      {produto.fotoPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={produto.fotoPath} alt={produto.nome} className="produto-resultado-thumb" />
      ) : (
        <div className="produto-resultado-thumb" aria-hidden="true" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{produto.nome}</p>
        <p className="truncate text-sm" style={{ color: "var(--muted)" }}>
          {produto.marca}
          {produto.medida ? ` · ${produto.medida}ml` : ""}
        </p>
        <span className={`badge ${semEstoque ? "badge-danger" : ""}`}>
          {produto.estoqueAtual} {produto.tipoVenda === "FRACIONADO" ? "ml" : ""} em estoque
        </span>
      </div>

      <div className="flex flex-col items-end gap-2">
        <span className="font-semibold">
          {centavosParaReais(produto.precoVenda)}
          {produto.tipoVenda === "FRACIONADO" && "/ml"}
        </span>
        <button
          type="button"
          className="produto-resultado-add"
          onClick={() => onAdicionar(produto)}
          disabled={semEstoque}
          aria-label={`Adicionar ${produto.nome} ao carrinho`}
        >
          <IconPlus />
        </button>
      </div>
    </div>
  );
}
