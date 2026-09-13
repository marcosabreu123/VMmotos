"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { centavosParaReais } from "@/lib/money";

type Produto = {
  nome: string;
  marca: string;
  medida: number | null;
  precoVenda: number;
  sku: string;
  codigoBarras: string | null;
};

export function EtiquetaProduto({ produto }: { produto: Produto }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const valorCodigo = produto.codigoBarras || produto.sku;

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, valorCodigo, {
        format: produto.codigoBarras ? "EAN13" : "CODE128",
        width: 2,
        height: 50,
        fontSize: 14,
        margin: 4,
      });
    } catch {
      JsBarcode(svgRef.current, valorCodigo, {
        format: "CODE128",
        width: 2,
        height: 50,
        fontSize: 14,
        margin: 4,
      });
    }
  }, [valorCodigo, produto.codigoBarras]);

  return (
    <div className="etiqueta">
      <p className="etiqueta-nome">{produto.nome}</p>
      <p className="etiqueta-detalhe">
        {produto.marca}
        {produto.medida ? ` · ${produto.medida}ml` : ""}
      </p>
      <svg ref={svgRef} />
      <p className="etiqueta-preco">{centavosParaReais(produto.precoVenda)}</p>
    </div>
  );
}
