// Gráficos simples em SVG puro, sem dependência externa — mesma filosofia hand-rolled
// já usada para CSV (lib/csv.ts) e etiquetas. Usam as CSS variables já definidas em
// globals.css para ficar consistentes com o tema claro/escuro do resto do app.

export type PontoGrafico = { label: string; valor: number };

const PALETA = ["var(--accent)", "var(--success)", "var(--warning)", "var(--danger)", "var(--metallic)", "var(--muted)"];

export function GraficoBarras({ dados, altura = 200 }: { dados: PontoGrafico[]; altura?: number }) {
  if (dados.length === 0) return <p className="state-empty">Sem dados para exibir.</p>;

  const largura = Math.max(320, dados.length * 70);
  const maiorValor = Math.max(...dados.map((d) => d.valor), 1);
  const larguraBarra = (largura / dados.length) * 0.55;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${largura} ${altura + 40}`} width={largura} height={altura + 40} role="img" aria-label="Gráfico de barras">
        <line x1={0} y1={altura} x2={largura} y2={altura} stroke="var(--border)" strokeWidth={1} />
        {dados.map((ponto, indice) => {
          const alturaBarra = (ponto.valor / maiorValor) * (altura - 20);
          const x = (largura / dados.length) * indice + (largura / dados.length - larguraBarra) / 2;
          const y = altura - alturaBarra;
          return (
            <g key={ponto.label + indice}>
              <rect x={x} y={y} width={larguraBarra} height={alturaBarra} rx={4} fill="var(--accent)" />
              <text x={x + larguraBarra / 2} y={altura + 16} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {ponto.label.length > 10 ? `${ponto.label.slice(0, 9)}…` : ponto.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function GraficoLinha({ dados, altura = 200 }: { dados: PontoGrafico[]; altura?: number }) {
  if (dados.length === 0) return <p className="state-empty">Sem dados para exibir.</p>;

  const largura = Math.max(320, dados.length * 70);
  const maiorValor = Math.max(...dados.map((d) => d.valor), 1);
  const passoX = dados.length > 1 ? largura / (dados.length - 1) : largura / 2;

  const pontos = dados.map((ponto, indice) => ({
    x: dados.length > 1 ? passoX * indice : largura / 2,
    y: altura - (ponto.valor / maiorValor) * (altura - 20),
    ...ponto,
  }));

  const linha = pontos.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${largura} ${altura + 40}`} width={largura} height={altura + 40} role="img" aria-label="Gráfico de linha">
        <line x1={0} y1={altura} x2={largura} y2={altura} stroke="var(--border)" strokeWidth={1} />
        <polyline points={linha} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {pontos.map((ponto, indice) => (
          <g key={ponto.label + indice}>
            <circle cx={ponto.x} cy={ponto.y} r={3.5} fill="var(--accent)" />
            <text x={ponto.x} y={altura + 16} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {ponto.label.length > 10 ? `${ponto.label.slice(0, 9)}…` : ponto.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function GraficoPizza({ dados, tamanho = 200 }: { dados: PontoGrafico[]; tamanho?: number }) {
  if (dados.length === 0) return <p className="state-empty">Sem dados para exibir.</p>;

  const total = dados.reduce((soma, d) => soma + d.valor, 0);
  const raio = tamanho / 2;
  const centro = raio;

  const anguloInicial = -90;
  const anguloPorFatia = dados.map((ponto) => (total > 0 ? (ponto.valor / total) * 360 : 0));
  const angulosAcumulados = anguloPorFatia.reduce<number[]>((acumulados, angulo, indice) => {
    const anterior = indice === 0 ? anguloInicial : acumulados[indice - 1];
    acumulados.push(anterior + angulo);
    return acumulados;
  }, []);

  const fatias = dados.map((ponto, indice) => {
    const fracao = total > 0 ? ponto.valor / total : 0;
    const anguloInicio = indice === 0 ? anguloInicial : angulosAcumulados[indice - 1];
    const anguloFim = angulosAcumulados[indice];

    const paraRad = (graus: number) => (graus * Math.PI) / 180;
    const x1 = centro + raio * Math.cos(paraRad(anguloInicio));
    const y1 = centro + raio * Math.sin(paraRad(anguloInicio));
    const x2 = centro + raio * Math.cos(paraRad(anguloFim));
    const y2 = centro + raio * Math.sin(paraRad(anguloFim));
    const arcoGrande = anguloFim - anguloInicio > 180 ? 1 : 0;

    const caminho = fracao >= 0.999
      ? `M ${centro - raio} ${centro} A ${raio} ${raio} 0 1 1 ${centro + raio} ${centro} A ${raio} ${raio} 0 1 1 ${centro - raio} ${centro}`
      : `M ${centro} ${centro} L ${x1} ${y1} A ${raio} ${raio} 0 ${arcoGrande} 1 ${x2} ${y2} Z`;

    return { ...ponto, caminho, cor: PALETA[indice % PALETA.length], fracao };
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox={`0 0 ${tamanho} ${tamanho}`} width={tamanho} height={tamanho} role="img" aria-label="Gráfico de pizza">
        {fatias.map((fatia, indice) => (
          <path key={fatia.label + indice} d={fatia.caminho} fill={fatia.cor} stroke="var(--surface)" strokeWidth={1} />
        ))}
      </svg>
      <ul className="flex flex-col gap-1 text-sm">
        {fatias.map((fatia, indice) => (
          <li key={fatia.label + indice} className="flex items-center gap-2">
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: fatia.cor, display: "inline-block" }} />
            <span>{fatia.label}</span>
            <span style={{ color: "var(--muted)" }}>({(fatia.fracao * 100).toFixed(0)}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
