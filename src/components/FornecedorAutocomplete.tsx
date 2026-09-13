"use client";

import { useEffect, useRef, useState } from "react";

export type FornecedorBusca = {
  id: string;
  nome: string;
  telefone: string | null;
};

export function FornecedorAutocomplete({
  onSelecionar,
  placeholder = "Buscar fornecedor por nome...",
}: {
  onSelecionar: (fornecedor: FornecedorBusca) => void;
  placeholder?: string;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<FornecedorBusca[]>([]);
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
        const resposta = await fetch(`/api/fornecedores/busca?q=${encodeURIComponent(termo)}`, {
          signal: controlador.signal,
        });
        if (!resposta.ok) return;
        const dados: FornecedorBusca[] = await resposta.json();
        setResultados(dados);
        setAberto(true);
      } catch {
        // busca cancelada ou falhou — próxima digitação tenta de novo
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
          {resultados.map((fornecedor) => (
            <li key={fornecedor.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:opacity-80"
                onClick={() => {
                  onSelecionar(fornecedor);
                  setTermo("");
                  setResultados([]);
                  setAberto(false);
                }}
              >
                <span className="font-medium">{fornecedor.nome}</span>
                {fornecedor.telefone && (
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {fornecedor.telefone}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
