"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ProdutoResultCard, type ProdutoVenda } from "./ProdutoResultCard";
import { ClienteSelector } from "./ClienteSelector";
import { ItemCarrinhoRow } from "./ItemCarrinhoRow";
import { FormaPagamentoPicker } from "./FormaPagamentoPicker";
import { IconCheck } from "./icons";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";
import type { ClienteBusca } from "./ClienteAutocomplete";
import type { FormaPagamento } from "@/lib/types";
import { finalizarVendaAction } from "@/app/vendas/actions";
import { nicho } from "@/config/nicho";

export type ItemCarrinhoCliente = {
  produto: ProdutoVenda;
  quantidade: number;
};

// Filtro rápido pelo atributo B configurado em src/config/nicho.ts.
const CATEGORIAS: Array<{ valor: string; label: string }> = [
  { valor: "", label: "Todos" },
  ...nicho.atributos.atributoB.opcoes.map((o) => ({ valor: o.valor, label: o.rotulo })),
];

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function CarrinhoVenda({ itensIniciais }: { itensIniciais?: ItemCarrinhoCliente[] }) {
  const [categoria, setCategoria] = useState<string>("");
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ProdutoVenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizarContador, setAtualizarContador] = useState(0);
  const controladorRef = useRef<AbortController | null>(null);

  const [itens, setItens] = useState<ItemCarrinhoCliente[]>(itensIniciais ?? []);
  const [cliente, setCliente] = useState<ClienteBusca | null>(null);
  // PIX já vem pré-selecionado (forma de pagamento mais comum) — o vendedor
  // só troca se for outro método; continua editável normalmente.
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>("PIX");
  const [descontoTotalStr, setDescontoTotalStr] = useState("");
  const [acrescimoTotalStr, setAcrescimoTotalStr] = useState("");
  const [dataVenda, setDataVenda] = useState(hojeISO());
  const [pagouTudo, setPagouTudo] = useState(true);
  const [valorPagoStr, setValorPagoStr] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const [pendente, iniciarTransicao] = useTransition();

  useEffect(() => {
    controladorRef.current?.abort();
    const controlador = new AbortController();
    controladorRef.current = controlador;

    const timeout = setTimeout(async () => {
      setCarregando(true);
      try {
        const params = new URLSearchParams();
        if (termo.trim()) params.set("q", termo.trim());
        if (categoria) params.set("atributoB", categoria);
        const resposta = await fetch(`/api/produtos/busca?${params.toString()}`, {
          signal: controlador.signal,
        });
        if (!resposta.ok) return;
        const dados: ProdutoVenda[] = await resposta.json();
        setResultados(dados);
        setCarregando(false);
      } catch {
        // busca cancelada — a próxima tentativa cobre
      }
    }, 200);

    return () => {
      clearTimeout(timeout);
      controlador.abort();
    };
  }, [termo, categoria, atualizarContador]);

  const subtotal = useMemo(
    () => itens.reduce((soma, item) => soma + item.produto.precoVenda * item.quantidade, 0),
    [itens]
  );
  const descontoTotal = reaisParaCentavos(descontoTotalStr || "0");
  const acrescimoTotal = reaisParaCentavos(acrescimoTotalStr || "0");
  const descontoInvalido = subtotal > 0 && descontoTotal > subtotal - acrescimoTotal;
  const total = Math.max(0, subtotal - descontoTotal + acrescimoTotal);
  const valorPago = pagouTudo ? total : reaisParaCentavos(valorPagoStr || "0");
  const saldoDevedor = Math.max(0, total - valorPago);
  const valorPagoInvalido = !pagouTudo && (valorPago < 0 || valorPago > total);

  function adicionarProduto(produto: ProdutoVenda) {
    setMensagem(null);
    setItens((atual) => {
      const existente = atual.find((item) => item.produto.id === produto.id);
      if (existente) {
        return atual.map((item) =>
          item.produto.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }
      return [...atual, { produto, quantidade: 1 }];
    });
  }

  function mudarQuantidade(produtoId: string, quantidade: number) {
    setItens((atual) => atual.map((item) => (item.produto.id === produtoId ? { ...item, quantidade } : item)));
  }

  function removerItem(produtoId: string) {
    setItens((atual) => atual.filter((item) => item.produto.id !== produtoId));
  }

  function finalizarVenda() {
    if (itens.length === 0) {
      setMensagem({ tipo: "erro", texto: "Adicione ao menos um produto ao carrinho." });
      return;
    }
    if (!formaPagamento) {
      setMensagem({ tipo: "erro", texto: "Selecione a forma de pagamento." });
      return;
    }
    if (descontoInvalido) {
      setMensagem({ tipo: "erro", texto: "O desconto não pode ser maior que o total da venda." });
      return;
    }
    if (valorPagoInvalido) {
      setMensagem({ tipo: "erro", texto: "O valor pago não pode ser negativo nem maior que o total da venda." });
      return;
    }
    if (!pagouTudo && saldoDevedor > 0 && !cliente) {
      setMensagem({ tipo: "erro", texto: "Selecione um cliente para registrar uma venda com pagamento parcial (fiado)." });
      return;
    }

    setMensagem(null);
    iniciarTransicao(async () => {
      const resultado = await finalizarVendaAction({
        itens: itens.map((item) => ({ produtoId: item.produto.id, quantidade: item.quantidade })),
        formaPagamento,
        descontoTotal,
        acrescimoTotal,
        clienteId: cliente?.id ?? null,
        dataVenda: dataVenda !== hojeISO() ? dataVenda : null,
        valorPago: pagouTudo ? undefined : valorPago,
      });

      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }

      setMensagem({ tipo: "sucesso", texto: `Venda registrada! Total: ${centavosParaReais(resultado.total)}` });
      setItens([]);
      setCliente(null);
      setFormaPagamento(null);
      setDescontoTotalStr("");
      setAcrescimoTotalStr("");
      setDataVenda(hojeISO());
      setPagouTudo(true);
      setValorPagoStr("");
      setAtualizarContador((atual) => atual + 1);
    });
  }

  return (
    <div className="venda-grid">
      {/* Coluna esquerda: filtros, busca e resultados ao vivo */}
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORIAS.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => setCategoria(opcao.valor)}
              className={`chip ${categoria === opcao.valor ? "chip-selected" : ""}`}
            >
              {opcao.label}
            </button>
          ))}
        </div>

        <input
          value={termo}
          onChange={(evento) => setTermo(evento.target.value)}
          placeholder="Buscar por nome, marca, SKU ou código de barras..."
          className="input mb-4"
          autoComplete="off"
        />

        <div className="venda-resultados">
          {carregando ? (
            <div className="flex justify-center py-10">
              <span className="spinner spinner-gold" />
            </div>
          ) : resultados.length === 0 ? (
            <p className="state-empty">
              {termo.trim() ? "Nenhum produto encontrado." : "Nenhum produto disponível nesta categoria."}
            </p>
          ) : (
            resultados.map((produto) => (
              <ProdutoResultCard key={produto.id} produto={produto} onAdicionar={adicionarProduto} />
            ))
          )}
        </div>
      </div>

      {/* Coluna direita: cliente, carrinho, pagamento — permanece visível ao rolar */}
      <div className="venda-painel">
        <ClienteSelector cliente={cliente} onSelecionar={setCliente} onRemover={() => setCliente(null)} />

        {itens.length === 0 ? (
          <p className="state-empty">Carrinho vazio. Adicione um produto para começar.</p>
        ) : (
          <ul className="venda-carrinho-lista">
            {itens.map((item) => (
              <ItemCarrinhoRow
                key={item.produto.id}
                item={item}
                aoMudarQuantidade={(quantidade) => mudarQuantidade(item.produto.id, quantidade)}
                aoRemover={() => removerItem(item.produto.id)}
              />
            ))}
          </ul>
        )}

        <div>
          <label className="label" htmlFor="dataVenda">
            Data da venda
          </label>
          <input
            id="dataVenda"
            type="date"
            className="input"
            max={hojeISO()}
            value={dataVenda}
            onChange={(evento) => setDataVenda(evento.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="descontoTotal">
              Desconto (R$)
            </label>
            <input
              id="descontoTotal"
              className="input"
              inputMode="decimal"
              placeholder="0,00"
              value={descontoTotalStr}
              onChange={(evento) => setDescontoTotalStr(evento.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="acrescimoTotal">
              Acréscimo (R$)
            </label>
            <input
              id="acrescimoTotal"
              className="input"
              inputMode="decimal"
              placeholder="0,00"
              value={acrescimoTotalStr}
              onChange={(evento) => setAcrescimoTotalStr(evento.target.value)}
            />
          </div>
        </div>

        <div>
          <p className="label">Forma de pagamento</p>
          <FormaPagamentoPicker valor={formaPagamento} aoMudar={setFormaPagamento} />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pagouTudo}
              onChange={(evento) => setPagouTudo(evento.target.checked)}
            />
            Cliente pagou o valor total agora
          </label>
          {!pagouTudo && (
            <div className="mt-2">
              <label className="label" htmlFor="valorPago">
                Valor pago agora (R$)
              </label>
              <input
                id="valorPago"
                className="input"
                inputMode="decimal"
                placeholder="0,00"
                value={valorPagoStr}
                onChange={(evento) => setValorPagoStr(evento.target.value)}
              />
              {saldoDevedor > 0 && (
                <p className="mt-1 text-sm" style={{ color: "var(--danger)" }}>
                  Fica em aberto: {centavosParaReais(saldoDevedor)} — {cliente ? cliente.nome : "selecione um cliente"}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="resumo-linha">
            <span>Subtotal</span>
            <span>{centavosParaReais(subtotal)}</span>
          </div>
          <div className="resumo-linha">
            <span>Desconto</span>
            <span>-{centavosParaReais(descontoTotal)}</span>
          </div>
          {acrescimoTotal > 0 && (
            <div className="resumo-linha">
              <span>Acréscimo</span>
              <span>+{centavosParaReais(acrescimoTotal)}</span>
            </div>
          )}
          <div className="resumo-total">
            <span className="label-caps">Total</span>
            <span className="resumo-total-valor">{centavosParaReais(total)}</span>
          </div>
        </div>

        {mensagem?.tipo === "erro" && (
          <p className="state-error" role="alert">
            {mensagem.texto}
          </p>
        )}
        {mensagem?.tipo === "sucesso" && (
          <div className="state-success" role="status">
            <span className="state-success-icon">
              <IconCheck />
            </span>
            <span>{mensagem.texto}</span>
          </div>
        )}

        <button type="button" onClick={finalizarVenda} disabled={pendente} className="btn btn-primary btn-block btn-lg">
          {pendente ? <span className="spinner" /> : "Finalizar venda"}
        </button>
      </div>
    </div>
  );
}
