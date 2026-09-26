"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { centavosParaReais } from "@/lib/money";
import {
  recortarPeriodo,
  type IntervaloPersonalizado,
  type PeriodoGrafico,
  type PontoFaturamento,
} from "@/lib/faturamento-grafico";

/**
 * Faturamento por período, dia a dia, com leitura por cima do mouse.
 *
 * Desenhado à mão em SVG em vez de trazer uma biblioteca de gráficos: é uma
 * linha só, e uma dependência de gráfico custaria mais no carregamento desta
 * tela — que o dono abre o dia inteiro — do que o desenho inteiro pesa.
 *
 * A largura vem de um ResizeObserver, e não de um viewBox esticado: assim o
 * texto dos eixos fica no tamanho certo em qualquer tela, em vez de encolher
 * junto com o desenho no celular.
 */

const ALTURA = 230;
const MARGEM = { topo: 18, direita: 14, baixo: 26, esquerda: 46 };

/**
 * Valor do eixo sem centavos: "2.000", não "2.000,00".
 *
 * No celular o gráfico tem ~290px e a coluna dos rótulos comia 20% disso. O
 * centavo no eixo não informa nada — quem quer o número exato passa o mouse.
 */
function rotuloEixo(centavos: number): string {
  return Math.round(centavos / 100).toLocaleString("pt-BR");
}

const PERIODOS: Array<{ valor: PeriodoGrafico; rotulo: string }> = [
  { valor: "semana", rotulo: "Semana" },
  { valor: "mes", rotulo: "Mês" },
  { valor: "ano", rotulo: "Ano" },
  { valor: "tudo", rotulo: "Todo o período" },
];

function diaCurto(dia: string): string {
  const [, mes, data] = dia.split("-");
  return `${data}/${mes}`;
}

function diaPorExtenso(dia: string): string {
  const [ano, mes, data] = dia.split("-").map(Number);
  // Meio-dia UTC: longe o bastante das bordas para o fuso não mudar a data.
  const texto = new Date(Date.UTC(ano, mes - 1, data, 12)).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
  // Só a primeira letra: o capitalize do CSS escreveria "Quarta-Feira, 16 De
  // Setembro", com maiúscula em "Feira" e "De".
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Escala "redonda" para o topo do eixo — 0, 50, 100, 250, 500, 1000... */
function tetoBonito(valor: number): number {
  if (valor <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(valor));
  for (const passo of [1, 2, 2.5, 5, 10]) {
    const candidato = passo * magnitude;
    if (candidato >= valor) return candidato;
  }
  return 10 * magnitude;
}

export function GraficoFaturamento({ pontos }: { pontos: PontoFaturamento[] }) {
  const [periodo, setPeriodo] = useState<PeriodoGrafico>("mes");
  const [intervalo, setIntervalo] = useState<IntervaloPersonalizado>({ de: "", ate: "" });
  const [indiceAtivo, setIndiceAtivo] = useState<number | null>(null);
  const [largura, setLargura] = useState(0);
  const caixaRef = useRef<HTMLDivElement>(null);

  // Limites dos campos de data: não adianta oferecer dia sem venda nenhuma
  // antes da loja existir, nem data no futuro.
  const primeiroDia = pontos[0]?.dia ?? "";
  const ultimoDia = pontos[pontos.length - 1]?.dia ?? "";

  useEffect(() => {
    const elemento = caixaRef.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => setLargura(entrada.contentRect.width));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  const serie = useMemo(
    () => recortarPeriodo(pontos, periodo, intervalo),
    [pontos, periodo, intervalo]
  );

  const resumo = useMemo(() => {
    const total = serie.reduce((soma, p) => soma + p.totalCentavos, 0);
    const vendas = serie.reduce((soma, p) => soma + p.vendas, 0);
    const melhor = serie.reduce<PontoFaturamento | null>(
      (m, p) => (p.totalCentavos > 0 && (!m || p.totalCentavos > m.totalCentavos) ? p : m),
      null
    );
    return { total, vendas, melhor };
  }, [serie]);

  const larguraPlot = Math.max(0, largura - MARGEM.esquerda - MARGEM.direita);
  const alturaPlot = ALTURA - MARGEM.topo - MARGEM.baixo;
  const teto = tetoBonito(Math.max(...serie.map((p) => p.totalCentavos), 0) / 100) * 100;

  // Um ponto só (loja no primeiro dia) fica no meio, não colado na borda.
  const x = (indice: number) =>
    MARGEM.esquerda + (serie.length === 1 ? larguraPlot / 2 : (indice / (serie.length - 1)) * larguraPlot);
  const y = (centavos: number) => MARGEM.topo + alturaPlot - (centavos / teto) * alturaPlot;

  const linha = serie.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.totalCentavos).toFixed(1)}`).join(" ");
  const area =
    serie.length > 0
      ? `${linha} L ${x(serie.length - 1).toFixed(1)} ${MARGEM.topo + alturaPlot} L ${x(0).toFixed(1)} ${MARGEM.topo + alturaPlot} Z`
      : "";

  const ativo = indiceAtivo !== null ? serie[indiceAtivo] : null;

  function aoMover(evento: React.PointerEvent<SVGSVGElement>) {
    if (serie.length === 0 || larguraPlot <= 0) return;
    const caixa = evento.currentTarget.getBoundingClientRect();
    const posicao = evento.clientX - caixa.left - MARGEM.esquerda;
    const proporcao = serie.length === 1 ? 0 : posicao / larguraPlot;
    // Arredonda para o dia MAIS PRÓXIMO: quem passa o mouse mira numa data,
    // não num traço de 2px.
    const indice = Math.round(proporcao * (serie.length - 1));
    setIndiceAtivo(Math.min(serie.length - 1, Math.max(0, indice)));
  }

  // Poucos rótulos no eixo: com 365 dias, um por dia vira borrão.
  const passoRotulo = Math.max(1, Math.ceil(serie.length / 6));
  const rotulosX = serie
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => i % passoRotulo === 0 || i === serie.length - 1);

  return (
    <section className="card p-5">
      <div className="grafico-topo">
        <div>
          <p className="label-caps mb-1">Faturamento por período</p>
          <p className="grafico-total">{centavosParaReais(resumo.total)}</p>
          <p className="ajuda">
            {resumo.vendas} venda(s)
            {serie.length > 0 && ` · ${diaCurto(serie[0].dia)} a ${diaCurto(serie[serie.length - 1].dia)}`}
          </p>
        </div>

        {/* Filtro numa linha só, acima do gráfico. Os atalhos vêm primeiro e o
            personalizado por último: é o que se usa menos. */}
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              className={`chip ${periodo === opcao.valor ? "chip-selected" : ""}`}
              onClick={() => {
                setPeriodo(opcao.valor);
                setIndiceAtivo(null);
              }}
            >
              {opcao.rotulo}
            </button>
          ))}
          <button
            type="button"
            className={`chip ${periodo === "personalizado" ? "chip-selected" : ""}`}
            onClick={() => {
              // Abre já com o intervalo que está na tela: assim o gráfico não
              // apaga esperando ele preencher as duas datas.
              if (!intervalo.de || !intervalo.ate) {
                setIntervalo({
                  de: serie[0]?.dia ?? primeiroDia,
                  ate: serie[serie.length - 1]?.dia ?? ultimoDia,
                });
              }
              setPeriodo("personalizado");
              setIndiceAtivo(null);
            }}
          >
            Personalizado
          </button>
        </div>
      </div>

      {periodo === "personalizado" && (
        <div className="grafico-datas">
          <label>
            <span className="label">De</span>
            <input
              type="date"
              className="input"
              value={intervalo.de}
              min={primeiroDia}
              max={ultimoDia}
              onChange={(evento) => {
                setIntervalo((atual) => ({ ...atual, de: evento.target.value }));
                setIndiceAtivo(null);
              }}
            />
          </label>
          <label>
            <span className="label">Até</span>
            <input
              type="date"
              className="input"
              value={intervalo.ate}
              min={primeiroDia}
              max={ultimoDia}
              onChange={(evento) => {
                setIntervalo((atual) => ({ ...atual, ate: evento.target.value }));
                setIndiceAtivo(null);
              }}
            />
          </label>
        </div>
      )}

      <div ref={caixaRef} className="grafico-caixa">
        {serie.length === 0 ? (
          <p className="state-empty">
            {periodo === "personalizado"
              ? "Nenhuma venda nesse intervalo. Escolha outras datas."
              : "Nenhuma venda registrada ainda."}
          </p>
        ) : (
          largura > 0 && (
            <svg
              width={largura}
              height={ALTURA}
              role="img"
              aria-label={`Faturamento por período. Total de ${centavosParaReais(resumo.total)} em ${serie.length} dia(s).`}
              onPointerMove={aoMover}
              onPointerLeave={() => setIndiceAtivo(null)}
              style={{ touchAction: "pan-y" }}
            >
              <defs>
                <linearGradient id="grad-faturamento" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grade: fio de cabelo, um tom acima do fundo — nunca tracejada. */}
              {[0, 0.5, 1].map((fracao) => {
                const posicaoY = MARGEM.topo + alturaPlot * fracao;
                return (
                  <g key={fracao}>
                    <line
                      x1={MARGEM.esquerda}
                      y1={posicaoY}
                      x2={largura - MARGEM.direita}
                      y2={posicaoY}
                      stroke="var(--border)"
                      strokeWidth={1}
                    />
                    <text x={MARGEM.esquerda - 10} y={posicaoY + 4} textAnchor="end" className="grafico-eixo">
                      {rotuloEixo(teto * (1 - fracao))}
                    </text>
                  </g>
                );
              })}

              <path d={area} fill="url(#grad-faturamento)" />
              <path d={linha} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

              {rotulosX.map(({ p, i }) => (
                <text
                  key={p.dia}
                  x={x(i)}
                  y={ALTURA - 8}
                  // As pontas ancoram para dentro; centralizadas, a primeira e
                  // a última data ficavam cortadas pela borda do desenho.
                  textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"}
                  className="grafico-eixo"
                >
                  {diaCurto(p.dia)}
                </text>
              ))}

              {/* Único rótulo escrito no desenho: o melhor dia. Número em todo
                  ponto viraria bagunça e ninguém leria. */}
              {resumo.melhor && !ativo && (() => {
                const indice = serie.findIndex((p) => p.dia === resumo.melhor!.dia);
                const posX = x(indice);
                return (
                  <text
                    x={Math.min(Math.max(posX, MARGEM.esquerda + 26), largura - MARGEM.direita - 26)}
                    y={y(resumo.melhor.totalCentavos) - 9}
                    textAnchor="middle"
                    className="grafico-melhor"
                  >
                    {centavosParaReais(resumo.melhor.totalCentavos)}
                  </text>
                );
              })()}

              {ativo && indiceAtivo !== null && (
                <g>
                  <line
                    x1={x(indiceAtivo)}
                    y1={MARGEM.topo}
                    x2={x(indiceAtivo)}
                    y2={MARGEM.topo + alturaPlot}
                    stroke="var(--muted)"
                    strokeWidth={1}
                  />
                  {/* Anel na cor da superfície para o ponto não sumir na linha. */}
                  <circle cx={x(indiceAtivo)} cy={y(ativo.totalCentavos)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
                </g>
              )}
            </svg>
          )
        )}

        {ativo && (
          <div
            className="grafico-tooltip"
            style={{
              // Perto da borda direita o balão vira para a esquerda, senão
              // sairia da tela.
              left: Math.min(Math.max(x(indiceAtivo ?? 0), 70), Math.max(70, largura - 70)),
            }}
          >
            {/* O valor vem primeiro e forte: quem está com o mouse em cima já
                sabe a data, quer o número. */}
            <strong>{centavosParaReais(ativo.totalCentavos)}</strong>
            <span>{ativo.vendas} venda(s)</span>
            <span className="grafico-tooltip-dia">{diaPorExtenso(ativo.dia)}</span>
          </div>
        )}
      </div>
    </section>
  );
}
