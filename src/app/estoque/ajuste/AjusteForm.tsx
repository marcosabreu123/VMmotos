"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProdutoAutocomplete, type ProdutoBusca } from "@/components/ProdutoAutocomplete";
import {
  ajustarEstoquePorProdutoAction,
  transferirDemonstracaoPorProdutoAction,
  registrarSaidaDemonstracaoPorProdutoAction,
} from "./actions";

type Modo = "ajuste" | "transferencia" | "saida_demonstracao";

export function AjusteForm({ produtoInicial }: { produtoInicial?: ProdutoBusca }) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [produto, setProduto] = useState<ProdutoBusca | undefined>(produtoInicial);
  const [modo, setModo] = useState<Modo>("ajuste");

  const [poolAjuste, setPoolAjuste] = useState<"VENDA" | "DEMONSTRACAO">("VENDA");
  const [tipoAjuste, setTipoAjuste] = useState<
    "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO" | "PERDA_VENCIMENTO" | "PERDA_DEFEITO" | "BRINDE"
  >("AJUSTE_NEGATIVO");
  const [motivo, setMotivo] = useState("");

  const [sentido, setSentido] = useState<"VENDA_PARA_DEMONSTRACAO" | "DEMONSTRACAO_PARA_VENDA">("VENDA_PARA_DEMONSTRACAO");

  const [quantidade, setQuantidade] = useState("");

  const unidade = produto?.tipoVenda === "FRACIONADO" ? "ml" : "un.";

  function confirmar() {
    if (!produto) {
      setMensagem("Selecione o produto.");
      return;
    }
    const qtd = Number(quantidade) || 0;
    if (qtd <= 0) {
      setMensagem("Informe uma quantidade válida.");
      return;
    }
    if (modo !== "transferencia" && !motivo.trim()) {
      setMensagem("Informe o motivo.");
      return;
    }

    setMensagem(null);
    setSucesso(null);
    iniciarTransicao(async () => {
      const resultado =
        modo === "ajuste"
          ? await ajustarEstoquePorProdutoAction({
              produtoId: produto.id,
              pool: poolAjuste,
              tipo: tipoAjuste,
              quantidade: qtd,
              motivo,
            })
          : modo === "transferencia"
            ? await transferirDemonstracaoPorProdutoAction({ produtoId: produto.id, sentido, quantidade: qtd })
            : await registrarSaidaDemonstracaoPorProdutoAction({ produtoId: produto.id, quantidade: qtd, motivo });

      if (!resultado.ok) {
        setMensagem(resultado.erro);
        return;
      }
      setQuantidade("");
      setMotivo("");
      setSucesso("Operação registrada com sucesso.");
      router.refresh();
    });
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div>
        <label className="label">Produto *</label>
        {produto ? (
          <div className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
            <span>
              <span className="font-medium">{produto.nome}</span>{" "}
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {produto.marca} · {produto.sku}
              </span>
            </span>
            <button type="button" className="btn btn-outline" onClick={() => setProduto(undefined)}>
              Trocar
            </button>
          </div>
        ) : (
          <ProdutoAutocomplete onSelecionar={setProduto} />
        )}
      </div>

      <div>
        <label className="label">Tipo de operação</label>
        <select className="input" value={modo} onChange={(evento) => setModo(evento.target.value as Modo)}>
          <option value="ajuste">Ajuste / baixa de produto (perda, defeito, brinde, contagem)</option>
          <option value="transferencia">Transferência venda ↔ demonstracao</option>
          <option value="saida_demonstracao">Saída de demonstracao (uso/descarte)</option>
        </select>
      </div>

      {modo === "ajuste" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select className="input" value={poolAjuste} onChange={(evento) => setPoolAjuste(evento.target.value as typeof poolAjuste)}>
            <option value="VENDA">Pool venda</option>
            <option value="DEMONSTRACAO">Pool demonstracao</option>
          </select>
          <select className="input" value={tipoAjuste} onChange={(evento) => setTipoAjuste(evento.target.value as typeof tipoAjuste)}>
            <option value="AJUSTE_POSITIVO">Ajuste positivo (sobra)</option>
            <option value="AJUSTE_NEGATIVO">Ajuste negativo (erro de contagem)</option>
            <option value="PERDA_VENCIMENTO">Baixa por vencimento</option>
            <option value="PERDA_DEFEITO">Baixa por defeito</option>
            <option value="BRINDE">Baixa (brinde/amostra grátis)</option>
          </select>
        </div>
      )}

      {modo === "transferencia" && (
        <select className="input" value={sentido} onChange={(evento) => setSentido(evento.target.value as typeof sentido)}>
          <option value="VENDA_PARA_DEMONSTRACAO">Venda → Demonstracao</option>
          <option value="DEMONSTRACAO_PARA_VENDA">Demonstracao → Venda</option>
        </select>
      )}

      <div>
        <label className="label" htmlFor="quantidade">
          Quantidade ({unidade}) *
        </label>
        <input
          id="quantidade"
          type="number"
          min={1}
          className="input"
          value={quantidade}
          onChange={(evento) => setQuantidade(evento.target.value)}
        />
      </div>

      {modo !== "transferencia" && (
        <div>
          <label className="label" htmlFor="motivo">
            Motivo *
          </label>
          <textarea id="motivo" className="input" rows={2} value={motivo} onChange={(evento) => setMotivo(evento.target.value)} />
        </div>
      )}

      {mensagem && (
        <p className="state-error" role="alert">
          {mensagem}
        </p>
      )}
      {sucesso && !mensagem && (
        <p className="badge badge-success w-fit" role="status">
          {sucesso}
        </p>
      )}

      <button type="button" className="btn btn-primary btn-block btn-lg" disabled={pendente || !produto} onClick={confirmar}>
        {pendente ? <span className="spinner" /> : "Confirmar"}
      </button>
    </div>
  );
}
