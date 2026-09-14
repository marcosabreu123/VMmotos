"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconSino } from "./icons";
import type { Alerta } from "@/lib/alertas";

/**
 * Sininho de alertas do topo.
 *
 * O contador só conta os urgentes (vermelhos). Contar tudo faria o número
 * nunca zerar — sempre há uma peça chegando no mínimo — e um contador que
 * nunca zera deixa de ser lido.
 *
 * Sem alerta nenhum, o sino aparece apagado e sem número: o estado bom
 * também precisa ser visível, senão o dono fica na dúvida se a tela quebrou.
 */
export function SinoAlertas({ alertas, carregando }: { alertas: Alerta[]; carregando?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

  const urgentes = alertas.filter((a) => a.severidade === "urgente").length;

  // Fecha ao clicar fora ou apertar Esc — comportamento esperado de qualquer
  // menu suspenso.
  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(evento: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div className="sino-caixa" ref={caixaRef}>
      <button
        type="button"
        className={`sino-botao${alertas.length === 0 ? " sino-vazio" : ""}`}
        onClick={() => setAberto((a) => !a)}
        disabled={carregando}
        aria-label={
          carregando
            ? "Alertas: carregando"
            : alertas.length === 0
              ? "Alertas: nada para ver"
              : `Alertas: ${alertas.length} ${alertas.length === 1 ? "item" : "itens"}`
        }
        aria-expanded={aberto}
      >
        <IconSino width={19} height={19} />
        {urgentes > 0 && <span className="sino-contador">{urgentes}</span>}
        {urgentes === 0 && alertas.length > 0 && <span className="sino-ponto" aria-hidden="true" />}
      </button>

      {aberto && (
        <div className="sino-painel" role="dialog" aria-label="Alertas">
          {alertas.length === 0 ? (
            <p className="sino-tudo-certo">Nada para resolver agora.</p>
          ) : (
            <ul>
              {alertas.map((a) => (
                <li key={a.chave}>
                  <Link href={a.href} className="sino-item" onClick={() => setAberto(false)}>
                    <span className={`sino-marca sino-marca-${a.severidade}`} aria-hidden="true" />
                    <span>{a.texto}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
