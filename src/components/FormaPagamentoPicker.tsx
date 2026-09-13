"use client";

import type { FormaPagamento } from "@/lib/types";
import { IconDinheiro, IconPix, IconCartao } from "./icons";

const OPCOES: { valor: FormaPagamento; label: string; Icon: typeof IconDinheiro }[] = [
  { valor: "DINHEIRO", label: "Dinheiro", Icon: IconDinheiro },
  { valor: "PIX", label: "Pix", Icon: IconPix },
  { valor: "CARTAO_DEBITO", label: "Débito", Icon: IconCartao },
  { valor: "CARTAO_CREDITO", label: "Crédito", Icon: IconCartao },
];

export function FormaPagamentoPicker({
  valor,
  aoMudar,
}: {
  valor: FormaPagamento | null;
  aoMudar: (valor: FormaPagamento) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {OPCOES.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          onClick={() => aoMudar(opcao.valor)}
          aria-pressed={valor === opcao.valor}
          className={`payment-btn ${valor === opcao.valor ? "payment-btn-active" : ""}`}
        >
          <opcao.Icon />
          <span className="label-caps" style={{ color: "inherit", fontSize: "10px" }}>
            {opcao.label}
          </span>
        </button>
      ))}
    </div>
  );
}
