"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconCodigoBarras } from "./icons";

/**
 * Campo para o leitor de código de barras.
 *
 * Um leitor de código de barras é, para o computador, um teclado: ele "digita"
 * o código muito rápido e normalmente termina com Enter. Três coisas precisam
 * estar certas ou ele parece quebrado no balcão:
 *
 * 1. O Enter do leitor NÃO pode enviar o formulário. No cadastro de peça isso
 *    salvaria a peça pela metade a cada bipada — por isso o preventDefault.
 * 2. Leitor que não manda Enter também tem que funcionar. Nem todo aparelho vem
 *    configurado assim, e o dono não tem como descobrir isso sozinho. Então o
 *    campo também reconhece a RAJADA: teclas chegando em menos de 60ms uma da
 *    outra é máquina, não gente, e depois de uma pausa curta ele bipa sozinho.
 *    Digitação humana nunca dispara isso — o valor só sai no Enter.
 * 3. Depois de bipar, o foco volta para o campo. É o que permite bipar uma peça
 *    atrás da outra sem tocar no mouse.
 */

/** Acima disso é dedo humano; abaixo, máquina. */
const INTERVALO_LEITOR_MS = 60;
/** Silêncio que marca o fim da rajada do leitor. */
const SILENCIO_MS = 120;
/** Códigos reais têm bem mais que isso; o piso só evita disparo por engano. */
const MINIMO_CODIGO = 4;

export function CampoCodigoBarras({
  aoBipar,
  nome,
  valorInicial = "",
  limparAposBipar = true,
  focoAutomatico = false,
  rotulo = "Código de barras",
  ajuda,
  children,
}: {
  aoBipar: (codigo: string) => void | Promise<void>;
  /** Quando presente, o valor também vai junto no envio do formulário. */
  nome?: string;
  valorInicial?: string;
  /** Venda limpa a cada bipada; cadastro mantém o código no campo. */
  limparAposBipar?: boolean;
  focoAutomatico?: boolean;
  rotulo?: string;
  ajuda?: string;
  /** Resultado da última bipada, renderizado abaixo do campo. */
  children?: ReactNode;
}) {
  const [valor, setValor] = useState(valorInicial);
  const [ocupado, setOcupado] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ultimaTeclaRef = useRef(0);
  const rajadaRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // No celular o foco automático abre o teclado por cima da tela, e lá o
    // leitor nem existe. Só faz sentido em quem tem mouse — o balcão.
    if (!focoAutomatico) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    inputRef.current?.focus();
  }, [focoAutomatico]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  async function disparar(codigo: string) {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const limpo = codigo.trim();
    if (!limpo || ocupado) return;

    setOcupado(true);
    try {
      await aoBipar(limpo);
    } finally {
      setOcupado(false);
      if (limparAposBipar) {
        setValor("");
        inputRef.current?.focus();
      }
    }
  }

  function aoDigitar(novo: string) {
    const agora = Date.now();
    const intervalo = agora - ultimaTeclaRef.current;
    ultimaTeclaRef.current = agora;

    if (novo.length <= 1) rajadaRef.current = true;
    else if (intervalo > INTERVALO_LEITOR_MS) rajadaRef.current = false;

    setValor(novo);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (rajadaRef.current && novo.trim().length >= MINIMO_CODIGO) {
      timeoutRef.current = setTimeout(() => disparar(novo), SILENCIO_MS);
    }
  }

  return (
    <div className="campo-codigo">
      <label className="label" htmlFor={nome ?? "codigo-barras"}>
        {rotulo}
      </label>
      <div className="campo-codigo-linha">
        <span className="campo-codigo-icone" aria-hidden="true">
          {ocupado ? <span className="spinner" /> : <IconCodigoBarras />}
        </span>
        <input
          ref={inputRef}
          id={nome ?? "codigo-barras"}
          name={nome}
          value={valor}
          onChange={(evento) => aoDigitar(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key !== "Enter") return;
            // O Enter é do leitor, não do dono querendo salvar.
            evento.preventDefault();
            disparar(valor);
          }}
          placeholder="Bipe o código ou digite"
          className="input campo-codigo-input"
          autoComplete="off"
          inputMode="text"
        />
      </div>
      {ajuda && <p className="ajuda">{ajuda}</p>}
      {children}
    </div>
  );
}
