"use client";

import { centavosParaReais } from "@/lib/money";
import { IconMinus, IconPlus } from "./icons";
import type { ItemCarrinhoCliente } from "./CarrinhoVenda";

export function ItemCarrinhoRow({
  item,
  aoMudarQuantidade,
  aoRemover,
}: {
  item: ItemCarrinhoCliente;
  aoMudarQuantidade: (quantidade: number) => void;
  aoRemover: () => void;
}) {
  const subtotal = item.produto.precoVenda * item.quantidade;

  return (
    <li className="card flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.produto.nome}</p>
        <p className="truncate text-sm" style={{ color: "var(--muted)" }}>
          {item.produto.medida ? `${item.produto.medida}ml · ` : ""}
          {centavosParaReais(item.produto.precoVenda)}
          {item.produto.tipoVenda === "FRACIONADO" && "/ml"}
        </p>
      </div>

      {item.produto.tipoVenda === "FRACIONADO" ? (
        <input
          type="number"
          min={1}
          className="input"
          style={{ width: 80 }}
          value={item.quantidade}
          onChange={(evento) => aoMudarQuantidade(Math.max(1, Math.round(Number(evento.target.value) || 1)))}
          aria-label="Quantidade em ml"
        />
      ) : (
        <div className="qty-stepper">
          <button type="button" onClick={() => aoMudarQuantidade(Math.max(1, item.quantidade - 1))} aria-label="Diminuir quantidade">
            <IconMinus />
          </button>
          <span>{item.quantidade}</span>
          <button type="button" onClick={() => aoMudarQuantidade(item.quantidade + 1)} aria-label="Aumentar quantidade">
            <IconPlus />
          </button>
        </div>
      )}

      <div className="flex flex-col items-end gap-1">
        <span className="font-semibold">{centavosParaReais(subtotal)}</span>
        <button
          type="button"
          onClick={aoRemover}
          className="label-caps"
          style={{ color: "var(--danger)", fontSize: "10px" }}
          aria-label="Remover item"
        >
          Remover
        </button>
      </div>
    </li>
  );
}
