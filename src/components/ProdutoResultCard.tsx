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
        {/* Marca e estoque na MESMA linha. Separados, cada peça ocupava 103px
            de altura e só cabiam 3 na tela — quem está no balcão precisa ver
            várias de uma vez para achar a certa. */}
        <div className="produto-resultado-sub">
          <span className="truncate" style={{ color: "var(--muted)" }}>
            {produto.marca}
            {produto.medida ? ` · ${produto.medida}ml` : ""}
          </span>
          <span className={`badge ${semEstoque ? "badge-danger" : ""}`}>
            {produto.estoqueAtual}
            {produto.tipoVenda === "FRACIONADO" ? " ml" : ""} em estoque
          </span>
        </div>
      </div>

      {/* Preço e botão lado a lado, não empilhados: empilhados eles sozinhos
          definiam a altura da linha (36px do botão + 24px do preço + espaço). */}
      <div className="flex shrink-0 items-center gap-3">
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
