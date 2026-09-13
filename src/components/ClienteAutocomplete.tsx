"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { criarClienteRapidoAction } from "@/app/clientes/actions";

export type ClienteBusca = {
  id: string;
  nome: string;
  telefone: string | null;
  totalCompras: number;
};

export function ClienteAutocomplete({
  onSelecionar,
}: {
  onSelecionar: (cliente: ClienteBusca) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ClienteBusca[]>([]);
  const [aberto, setAberto] = useState(false);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [telefoneNovo, setTelefoneNovo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciarTransicao] = useTransition();
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
        const resposta = await fetch(`/api/clientes/busca?q=${encodeURIComponent(termo)}`, {
          signal: controlador.signal,
        });
        if (!resposta.ok) return;
        const dados: ClienteBusca[] = await resposta.json();
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

  function criarNovo() {
    setErro(null);
    iniciarTransicao(async () => {
      try {
        const cliente = await criarClienteRapidoAction(termo, telefoneNovo);
        onSelecionar(cliente);
        setTermo("");
        setTelefoneNovo("");
        setCriandoNovo(false);
        setResultados([]);
        setAberto(false);
      } catch {
        setErro("Não foi possível criar o cliente.");
      }
    });
  }

  return (
    <div className="relative">
      <input
        value={termo}
        onChange={(evento) => {
          setTermo(evento.target.value);
          setCriandoNovo(false);
        }}
        onFocus={() => setAberto(resultados.length > 0)}
        placeholder="Buscar cliente por nome ou telefone (opcional)..."
        className="input"
        autoComplete="off"
      />

      {aberto && termo.trim().length >= 2 && !criandoNovo && (
        <ul
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
        >
          {resultados.map((cliente) => (
            <li key={cliente.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:opacity-80"
                onClick={() => {
                  onSelecionar(cliente);
                  setTermo("");
                  setResultados([]);
                  setAberto(false);
                }}
              >
                <span className="font-medium">{cliente.nome}</span>
                {cliente.telefone && (
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {cliente.telefone}
                  </span>
                )}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="label-caps flex w-full items-center px-4 py-3 text-left hover:opacity-80"
              style={{ color: "var(--accent)" }}
              onClick={() => setCriandoNovo(true)}
            >
              + Criar novo cliente &quot;{termo}&quot;
            </button>
          </li>
        </ul>
      )}

      {criandoNovo && (
        <div
          className="mt-2 flex flex-col gap-2 rounded-xl border p-3"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-sm">
            Novo cliente: <span className="font-medium">{termo}</span>
          </p>
          <input
            value={telefoneNovo}
            onChange={(evento) => setTelefoneNovo(evento.target.value)}
            placeholder="Telefone (opcional)"
            className="input"
          />
          {erro && (
            <p className="state-error" role="alert">
              {erro}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={criarNovo}>
              {pendente ? <span className="spinner" /> : "Salvar cliente"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setCriandoNovo(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
