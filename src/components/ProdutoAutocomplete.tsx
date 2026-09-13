"use client";

import { useEffect, useRef, useState } from "react";
import { centavosParaReais } from "@/lib/money";

export type ProdutoBusca = {
  id: string;
  nome: string;
  marca: string;
  sku: string;
  precoVenda: number;
  tipoVenda: "UNIDADE" | "FRACIONADO";
};

export function ProdutoAutocomplete({
  onSelecionar,
  placeholder = "Buscar por nome, marca, SKU ou código de barras...",
}: {
  onSelecionar: (produto: ProdutoBusca) => void;
  placeholder?: string;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ProdutoBusca[]>([]);
  const [aberto, setAberto] = useState(false);
  const controladorRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (termo.trim().length < 2) {
      return;
    }

    controladorRef.current?.abort();
    const controlador = new AbortController();
    controladorRef.current = controlador;

    const timeout = setTimeout(async () => {
      try {
        const resposta = await fetch(`/api/produtos/busca?q=${encodeURIComponent(termo)}`, {
          signal: controlador.signal,
        });
        if (!resposta.ok) return;
        const dados: ProdutoBusca[] = await resposta.json();
        setResultados(dados);
        setAberto(true);
      } catch {
        // busca cancelada ou falhou — nada a fazer, próximo termo tenta de novo
      }
    }, 200);

    return () => {
      clearTimeout(timeout);
      controlador.abort();
    };
  }, [termo]);

  return (
    <div className="relative">
      <input
        value={termo}
        onChange={(evento) => setTermo(evento.target.value)}
        onFocus={() => setAberto(resultados.length > 0)}
        placeholder={placeholder}
        className="input"
        autoComplete="off"
      />

      {aberto && termo.trim().length >= 2 && resultados.length > 0 && (
        <ul
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
        >
          {resultados.map((produto) => (
            <li key={produto.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:opacity-80"
                onClick={() => {
                  onSelecionar(produto);
                  setTermo("");
                  setResultados([]);
                  setAberto(false);
                }}
              >
                <span>
                  <span className="font-medium">{produto.nome}</span>{" "}
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {produto.marca} · {produto.sku}
                  </span>
                </span>
                <span className="font-semibold">{centavosParaReais(produto.precoVenda)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
