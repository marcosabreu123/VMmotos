"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelarVendaAction,
  registrarDevolucaoAction,
  adicionarObservacaoAction,
  corrigirClienteVendaAction,
  registrarUsoInsumosAction,
  registrarPagamentoVendaAction,
} from "../actions";
import { ClienteAutocomplete, type ClienteBusca } from "@/components/ClienteAutocomplete";
import { IconCheck } from "@/components/icons";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";

type ItemParaDevolucao = {
  id: string;
  produtoNome: string;
  quantidade: number;
  jaDevolvido: number;
};

type InsumoOpcao = { id: string; nome: string; unidade: string };

export function VendaAcoes({
  vendaId,
  status,
  observacoesAtuais,
  itensParaDevolucao,
  linkWhatsApp,
  insumosDisponiveis = [],
  saldoDevedor = 0,
}: {
  vendaId: string;
  status: "CONCLUIDA" | "CANCELADA" | "DEVOLVIDA_PARCIAL" | "DEVOLVIDA_TOTAL";
  observacoesAtuais: string;
  itensParaDevolucao: ItemParaDevolucao[];
  linkWhatsApp: string | null;
  insumosDisponiveis?: InsumoOpcao[];
  saldoDevedor?: number;
}) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);

  const [mostrarCancelar, setMostrarCancelar] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");

  const [mostrarDevolucao, setMostrarDevolucao] = useState(false);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");
  const [quantidadesDevolucao, setQuantidadesDevolucao] = useState<Record<string, number>>({});
  const [retornaEstoque, setRetornaEstoque] = useState<Record<string, boolean>>({});

  const [mostrarInsumo, setMostrarInsumo] = useState(false);
  const [quantidadesInsumo, setQuantidadesInsumo] = useState<Record<string, number>>({});

  const [editandoObservacao, setEditandoObservacao] = useState(false);
  const [observacao, setObservacao] = useState(observacoesAtuais);

  const [editandoCliente, setEditandoCliente] = useState(false);

  const [mostrarPagamento, setMostrarPagamento] = useState(false);
  const [valorPagamentoStr, setValorPagamentoStr] = useState("");

  function confirmarCancelamento() {
    if (!motivoCancelamento.trim()) {
      setMensagem({ tipo: "erro", texto: "Informe o motivo do cancelamento." });
      return;
    }
    iniciarTransicao(async () => {
      const resultado = await cancelarVendaAction(vendaId, motivoCancelamento);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      setMostrarCancelar(false);
      router.refresh();
    });
  }

  function confirmarDevolucao() {
    const itens = itensParaDevolucao
      .map((item) => ({
        itemVendaId: item.id,
        quantidade: quantidadesDevolucao[item.id] ?? 0,
        retornaEstoque: retornaEstoque[item.id] ?? true,
      }))
      .filter((item) => item.quantidade > 0);

    if (!motivoDevolucao.trim()) {
      setMensagem({ tipo: "erro", texto: "Informe o motivo da devolução." });
      return;
    }
    if (itens.length === 0) {
      setMensagem({ tipo: "erro", texto: "Informe a quantidade de ao menos um item para devolver." });
      return;
    }

    iniciarTransicao(async () => {
      const resultado = await registrarDevolucaoAction(vendaId, motivoDevolucao, itens);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      setMostrarDevolucao(false);
      router.refresh();
    });
  }

  function salvarObservacao() {
    iniciarTransicao(async () => {
      const resultado = await adicionarObservacaoAction(vendaId, observacao);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      setEditandoObservacao(false);
      router.refresh();
    });
  }

  function selecionarCliente(cliente: ClienteBusca) {
    iniciarTransicao(async () => {
      const resultado = await corrigirClienteVendaAction(vendaId, cliente.id);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      setEditandoCliente(false);
      router.refresh();
    });
  }

  const podeDevolver = itensParaDevolucao.some((item) => item.quantidade > item.jaDevolvido);

  function confirmarPagamento() {
    const valor = reaisParaCentavos(valorPagamentoStr || "0");
    if (valor <= 0) {
      setMensagem({ tipo: "erro", texto: "Informe um valor de pagamento válido." });
      return;
    }
    if (valor > saldoDevedor) {
      setMensagem({ tipo: "erro", texto: `O valor não pode ser maior que o saldo devedor (${centavosParaReais(saldoDevedor)}).` });
      return;
    }
    iniciarTransicao(async () => {
      const resultado = await registrarPagamentoVendaAction(vendaId, valor);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      setMostrarPagamento(false);
      setValorPagamentoStr("");
      router.refresh();
    });
  }

  function confirmarInsumos() {
    const itens = Object.entries(quantidadesInsumo)
      .map(([insumoId, quantidade]) => ({ insumoId, quantidade }))
      .filter((item) => item.quantidade > 0);

    if (itens.length === 0) {
      setMensagem({ tipo: "erro", texto: "Informe a quantidade de ao menos um insumo." });
      return;
    }

    iniciarTransicao(async () => {
      const resultado = await registrarUsoInsumosAction(vendaId, itens);
      if (!resultado.ok) {
        setMensagem({ tipo: "erro", texto: resultado.erro });
        return;
      }
      setMostrarInsumo(false);
      setQuantidadesInsumo({});
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {saldoDevedor > 0 && (
          <button type="button" className="btn btn-primary" onClick={() => setMostrarPagamento((atual) => !atual)}>
            Registrar pagamento
          </button>
        )}
        {status !== "CANCELADA" && (
          <button type="button" className="btn btn-outline" onClick={() => setMostrarCancelar(true)}>
            Cancelar venda
          </button>
        )}
        {status !== "CANCELADA" && podeDevolver && (
          <button type="button" className="btn btn-outline" onClick={() => setMostrarDevolucao(true)}>
            Registrar devolução
          </button>
        )}
        <button type="button" className="btn btn-outline" onClick={() => setEditandoObservacao((atual) => !atual)}>
          Adicionar observação
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setEditandoCliente((atual) => !atual)}>
          Corrigir cliente
        </button>
        {insumosDisponiveis.length > 0 && (
          <button type="button" className="btn btn-outline" onClick={() => setMostrarInsumo((atual) => !atual)}>
            Registrar insumo usado
          </button>
        )}
        <a
          href={`/vendas/nova?duplicar=${vendaId}`}
          className="btn btn-outline"
        >
          Duplicar venda
        </a>
        <button type="button" className="btn btn-outline no-print" onClick={() => window.print()}>
          Imprimir recibo
        </button>
        {linkWhatsApp && (
          <a href={linkWhatsApp} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
            Enviar por WhatsApp
          </a>
        )}
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

      {mostrarPagamento && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Registrar pagamento</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Saldo devedor atual: {centavosParaReais(saldoDevedor)}
          </p>
          <input
            className="input"
            inputMode="decimal"
            placeholder="0,00"
            value={valorPagamentoStr}
            onChange={(evento) => setValorPagamentoStr(evento.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={confirmarPagamento}>
              {pendente ? <span className="spinner" /> : "Confirmar pagamento"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMostrarPagamento(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {editandoObservacao && (
        <div className="card flex flex-col gap-3 p-4">
          <label className="label" htmlFor="observacao">
            Observação da venda
          </label>
          <textarea
            id="observacao"
            className="input"
            rows={3}
            value={observacao}
            onChange={(evento) => setObservacao(evento.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={salvarObservacao}>
              {pendente ? <span className="spinner" /> : "Salvar observação"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setEditandoObservacao(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mostrarInsumo && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Insumos utilizados nesta venda</p>
          <ul className="flex flex-col gap-3">
            {insumosDisponiveis.map((insumo) => (
              <li key={insumo.id} className="flex items-center gap-3">
                <span className="flex-1">
                  {insumo.nome} ({insumo.unidade})
                </span>
                <input
                  type="number"
                  min={0}
                  className="input"
                  style={{ width: 90 }}
                  placeholder="0"
                  value={quantidadesInsumo[insumo.id] ?? ""}
                  onChange={(evento) =>
                    setQuantidadesInsumo((atual) => ({ ...atual, [insumo.id]: Math.max(0, Number(evento.target.value) || 0) }))
                  }
                />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={confirmarInsumos}>
              {pendente ? <span className="spinner" /> : "Confirmar insumos"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMostrarInsumo(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {editandoCliente && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Novo cliente da venda</p>
          <ClienteAutocomplete onSelecionar={selecionarCliente} />
        </div>
      )}

      {mostrarCancelar && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Motivo do cancelamento *</p>
          <textarea
            className="input"
            rows={2}
            value={motivoCancelamento}
            onChange={(evento) => setMotivoCancelamento(evento.target.value)}
            placeholder="Ex.: cliente desistiu, erro no lançamento..."
          />
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Ao confirmar, os produtos voltam ao estoque e a venda passa para o status Cancelada. Essa ação não pode
            ser desfeita.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={confirmarCancelamento}>
              {pendente ? <span className="spinner" /> : "Confirmar cancelamento"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMostrarCancelar(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}

      {mostrarDevolucao && (
        <div className="card flex flex-col gap-3 p-4">
          <p className="label">Itens a devolver</p>
          <ul className="flex flex-col gap-3">
            {itensParaDevolucao.map((item) => {
              const disponivel = item.quantidade - item.jaDevolvido;
              if (disponivel <= 0) return null;
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3">
                  <span className="flex-1">{item.produtoNome}</span>
                  <input
                    type="number"
                    min={0}
                    max={disponivel}
                    className="input"
                    style={{ width: 90 }}
                    placeholder={`0 / ${disponivel}`}
                    value={quantidadesDevolucao[item.id] ?? ""}
                    onChange={(evento) =>
                      setQuantidadesDevolucao((atual) => ({
                        ...atual,
                        [item.id]: Math.min(disponivel, Math.max(0, Number(evento.target.value) || 0)),
                      }))
                    }
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={retornaEstoque[item.id] ?? true}
                      onChange={(evento) =>
                        setRetornaEstoque((atual) => ({ ...atual, [item.id]: evento.target.checked }))
                      }
                    />
                    Retorna ao estoque
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="label">Motivo da devolução *</p>
          <textarea
            className="input"
            rows={2}
            value={motivoDevolucao}
            onChange={(evento) => setMotivoDevolucao(evento.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={pendente} onClick={confirmarDevolucao}>
              {pendente ? <span className="spinner" /> : "Confirmar devolução"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMostrarDevolucao(false)}>
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
