"use client";

import { useState } from "react";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";
import {
  ordenarOpcoes,
  type OpcaoFrete,
  type ServicoIndisponivel,
  type OrdenacaoCotacao,
} from "@/lib/integracoes/melhorEnvio/normalizacao";

type EstadoCotador = "ocioso" | "calculando" | "erro";

export type ValoresIniciaisCotador = {
  cepOrigem?: string;
  cepDestino?: string;
  pesoKg?: number;
  alturaCm?: number;
  larguraCm?: number;
  comprimentoCm?: number;
};

export function CotadorFretes({
  cepOrigemPadrao,
  valoresIniciais,
}: {
  cepOrigemPadrao: string;
  valoresIniciais?: ValoresIniciaisCotador;
}) {
  const [cepOrigem, setCepOrigem] = useState(valoresIniciais?.cepOrigem ?? cepOrigemPadrao);
  const [cepDestino, setCepDestino] = useState(valoresIniciais?.cepDestino ?? "");
  const [pesoStr, setPesoStr] = useState(valoresIniciais?.pesoKg ? String(valoresIniciais.pesoKg).replace(".", ",") : "");
  const [alturaStr, setAlturaStr] = useState(valoresIniciais?.alturaCm ? String(valoresIniciais.alturaCm) : "");
  const [larguraStr, setLarguraStr] = useState(valoresIniciais?.larguraCm ? String(valoresIniciais.larguraCm) : "");
  const [comprimentoStr, setComprimentoStr] = useState(valoresIniciais?.comprimentoCm ? String(valoresIniciais.comprimentoCm) : "");
  const [valorDeclaradoStr, setValorDeclaradoStr] = useState("");
  const [nomeReferencia, setNomeReferencia] = useState("");
  const [observacao, setObservacao] = useState("");

  const [estado, setEstado] = useState<EstadoCotador>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [cotacaoId, setCotacaoId] = useState<string | null>(null);
  const [quotedAt, setQuotedAt] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<OpcaoFrete[]>([]);
  const [indisponiveis, setIndisponiveis] = useState<ServicoIndisponivel[]>([]);
  const [mostrarIndisponiveis, setMostrarIndisponiveis] = useState(false);

  const [ordenacao, setOrdenacao] = useState<OrdenacaoCotacao>("menor_preco");
  const [filtroTransportadora, setFiltroTransportadora] = useState("");
  const [filtroPrecoMax, setFiltroPrecoMax] = useState("");
  const [filtroPrazoMax, setFiltroPrazoMax] = useState("");

  const [selecionada, setSelecionada] = useState<OpcaoFrete | null>(null);

  const formValido = Boolean(
    cepOrigem.trim() && cepDestino.trim() && pesoStr.trim() && alturaStr.trim() && larguraStr.trim() && comprimentoStr.trim()
  );

  async function calcularFrete() {
    if (estado === "calculando") return;
    setErro(null);
    setCopiado(false);
    setEstado("calculando");
    setSelecionada(null);

    try {
      const resposta = await fetch("/api/fretes/cotar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cepOrigem,
          cepDestino,
          pesoKg: Number(pesoStr.replace(",", ".")),
          alturaCm: Number(alturaStr.replace(",", ".")),
          larguraCm: Number(larguraStr.replace(",", ".")),
          comprimentoCm: Number(comprimentoStr.replace(",", ".")),
          valorDeclaradoCentavos: valorDeclaradoStr ? reaisParaCentavos(valorDeclaradoStr) : undefined,
          nomeReferencia: nomeReferencia || undefined,
          observacao: observacao || undefined,
        }),
      });
      const dados = await resposta.json();

      if (!resposta.ok || !dados.success) {
        setErro(dados.erro ?? "Não foi possível calcular o frete neste momento. Tente novamente.");
        setEstado("erro");
        setOpcoes([]);
        setIndisponiveis([]);
        return;
      }

      setOpcoes(dados.opcoes ?? []);
      setIndisponiveis(dados.indisponiveis ?? []);
      setCotacaoId(dados.cotacaoId ?? null);
      setQuotedAt(dados.quotedAt ?? null);
      setEstado("ocioso");
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setEstado("erro");
    }
  }

  function novaCotacao() {
    setOpcoes([]);
    setIndisponiveis([]);
    setCotacaoId(null);
    setQuotedAt(null);
    setSelecionada(null);
    setErro(null);
    setCopiado(false);
    setEstado("ocioso");
  }

  function limpar() {
    setCepOrigem(cepOrigemPadrao);
    setCepDestino("");
    setPesoStr("");
    setAlturaStr("");
    setLarguraStr("");
    setComprimentoStr("");
    setValorDeclaradoStr("");
    setNomeReferencia("");
    setObservacao("");
    novaCotacao();
  }

  async function selecionarOpcao(opcao: OpcaoFrete) {
    setSelecionada(opcao);
    if (!cotacaoId) return;
    try {
      await fetch("/api/fretes/selecionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cotacaoId, opcao }),
      });
    } catch {
      // seleção é só um resumo local — falha silenciosa não impede o uso da cotação
    }
  }

  const opcoesFiltradas = opcoes.filter((opcao) => {
    if (filtroTransportadora && opcao.transportadora !== filtroTransportadora) return false;
    if (filtroPrecoMax && opcao.precoCentavos > reaisParaCentavos(filtroPrecoMax)) return false;
    if (filtroPrazoMax && (opcao.prazoDias ?? Infinity) > Number(filtroPrazoMax)) return false;
    return true;
  });
  const opcoesOrdenadas = ordenarOpcoes(opcoesFiltradas, ordenacao);
  const transportadoras = Array.from(new Set(opcoes.map((o) => o.transportadora)));

  function copiarResumo() {
    const opcao = selecionada ?? opcoesOrdenadas[0];
    if (!opcao) return;
    const agora = quotedAt ? new Date(quotedAt) : new Date();
    const texto = [
      "Cotação de frete",
      "",
      `Origem: CEP ${cepOrigem}`,
      `Destino: CEP ${cepDestino}`,
      `Peso: ${pesoStr} kg`,
      `Dimensões: ${alturaStr} × ${larguraStr} × ${comprimentoStr} cm`,
      "",
      "Opção escolhida:",
      `Transportadora: ${opcao.transportadora}`,
      `Serviço: ${opcao.servico}`,
      `Valor: ${centavosParaReais(opcao.precoCentavos)}`,
      `Prazo estimado: ${opcao.prazoDias ?? "?"} dias úteis`,
      "",
      `Cotação realizada em ${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
    ].join("\n");

    navigator.clipboard
      ?.writeText(texto)
      .then(() => setCopiado(true))
      .catch(() => setErro("Não foi possível copiar o resumo."));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold">Dados da cotação</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cepOrigem">
              CEP de origem *
            </label>
            <input
              id="cepOrigem"
              className="input"
              value={cepOrigem}
              onChange={(e) => setCepOrigem(e.target.value)}
              placeholder="00000-000"
            />
          </div>
          <div>
            <label className="label" htmlFor="cepDestino">
              CEP de destino *
            </label>
            <input
              id="cepDestino"
              className="input"
              value={cepDestino}
              onChange={(e) => setCepDestino(e.target.value)}
              placeholder="00000-000"
            />
          </div>
        </div>

        <p className="label-caps mb-2 mt-5">Embalagem</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="peso">
              Peso (kg) *
            </label>
            <input id="peso" className="input" inputMode="decimal" value={pesoStr} onChange={(e) => setPesoStr(e.target.value)} placeholder="0,5" />
          </div>
          <div>
            <label className="label" htmlFor="altura">
              Altura (cm) *
            </label>
            <input id="altura" className="input" inputMode="decimal" value={alturaStr} onChange={(e) => setAlturaStr(e.target.value)} placeholder="12" />
          </div>
          <div>
            <label className="label" htmlFor="largura">
              Largura (cm) *
            </label>
            <input id="largura" className="input" inputMode="decimal" value={larguraStr} onChange={(e) => setLarguraStr(e.target.value)} placeholder="15" />
          </div>
          <div>
            <label className="label" htmlFor="comprimento">
              Comprimento (cm) *
            </label>
            <input
              id="comprimento"
              className="input"
              inputMode="decimal"
              value={comprimentoStr}
              onChange={(e) => setComprimentoStr(e.target.value)}
              placeholder="20"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="valorDeclarado">
              Valor declarado (R$, opcional)
            </label>
            <input
              id="valorDeclarado"
              className="input"
              value={valorDeclaradoStr}
              onChange={(e) => setValorDeclaradoStr(e.target.value)}
              placeholder="199,90"
            />
          </div>
          <div>
            <label className="label" htmlFor="nomeReferencia">
              Referência (opcional)
            </label>
            <input id="nomeReferencia" className="input" value={nomeReferencia} onChange={(e) => setNomeReferencia(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="observacao">
              Observação (opcional)
            </label>
            <input id="observacao" className="input" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={calcularFrete} disabled={!formValido || estado === "calculando"}>
            {estado === "calculando" ? <span className="spinner" /> : "Calcular frete"}
          </button>
          <button type="button" className="btn btn-outline" onClick={limpar}>
            Limpar
          </button>
        </div>

        {erro && (
          <p className="state-error mt-4" role="alert">
            {erro}
          </p>
        )}
      </div>

      {opcoes.length > 0 && (
        <div className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Resultados</h2>
            <div className="flex flex-wrap gap-2">
              <select className="input" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as OrdenacaoCotacao)}>
                <option value="menor_preco">Menor preço</option>
                <option value="menor_prazo">Menor prazo</option>
                <option value="transportadora">Transportadora</option>
                <option value="custo_beneficio">Melhor custo-benefício</option>
              </select>
              {transportadoras.length > 1 && (
                <select className="input" value={filtroTransportadora} onChange={(e) => setFiltroTransportadora(e.target.value)}>
                  <option value="">Todas as transportadoras</option>
                  {transportadoras.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
              <input
                className="input"
                style={{ width: 140 }}
                value={filtroPrecoMax}
                onChange={(e) => setFiltroPrecoMax(e.target.value)}
                placeholder="Preço máx. (R$)"
              />
              <input
                className="input"
                style={{ width: 140 }}
                value={filtroPrazoMax}
                onChange={(e) => setFiltroPrazoMax(e.target.value)}
                placeholder="Prazo máx. (dias)"
              />
            </div>
          </div>

          {quotedAt && (
            <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
              Cotação realizada em {new Date(quotedAt).toLocaleString("pt-BR")}
            </p>
          )}

          {opcoesOrdenadas.length === 0 ? (
            <p className="state-empty">Nenhuma opção corresponde aos filtros atuais.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {opcoesOrdenadas.map((opcao) => (
                <li
                  key={opcao.id}
                  className="card p-4"
                  style={selecionada?.id === opcao.id ? { borderColor: "var(--accent)" } : undefined}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {opcao.transportadora} — {opcao.servico}
                      </p>
                      <p className="text-sm" style={{ color: "var(--muted)" }}>
                        Prazo estimado: {opcao.prazoDias ?? "—"} dia(s) útil(eis)
                        {opcao.prazoMinDias && opcao.prazoMaxDias ? ` (${opcao.prazoMinDias}–${opcao.prazoMaxDias})` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{centavosParaReais(opcao.precoCentavos)}</p>
                      {opcao.precoOriginalCentavos && opcao.precoOriginalCentavos > opcao.precoCentavos && (
                        <p className="text-sm" style={{ color: "var(--muted)", textDecoration: "line-through" }}>
                          {centavosParaReais(opcao.precoOriginalCentavos)}
                        </p>
                      )}
                    </div>
                    <button type="button" className="btn btn-outline" onClick={() => selecionarOpcao(opcao)}>
                      {selecionada?.id === opcao.id ? "Selecionada" : "Selecionar cotação"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selecionada && (
            <p className="state-empty mt-4">Esta ação não compra o frete e não gera etiqueta — só guarda a opção escolhida no histórico.</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-outline" onClick={calcularFrete}>
              Calcular novamente
            </button>
            <button type="button" className="btn btn-outline" onClick={novaCotacao}>
              Nova cotação
            </button>
            <button type="button" className="btn btn-outline" onClick={copiarResumo} disabled={opcoesOrdenadas.length === 0}>
              Copiar resumo
            </button>
            {copiado && <span className="text-sm" style={{ color: "var(--success)" }}>Copiado!</span>}
          </div>

          {indisponiveis.length > 0 && (
            <div className="mt-6">
              <button type="button" className="label-caps" onClick={() => setMostrarIndisponiveis((v) => !v)}>
                {mostrarIndisponiveis ? "Ocultar" : "Ver"} serviços indisponíveis ({indisponiveis.length})
              </button>
              {mostrarIndisponiveis && (
                <ul className="mt-2 flex flex-col gap-2">
                  {indisponiveis.map((servico, indice) => (
                    <li key={indice} className="card p-3 text-sm">
                      <span className="font-medium">
                        {servico.transportadora} — {servico.servico}:
                      </span>{" "}
                      {servico.motivo}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
