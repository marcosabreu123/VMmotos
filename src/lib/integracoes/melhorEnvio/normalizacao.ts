// Módulo puro (sem prisma/crypto/fetch de servidor) — pode ser importado
// tanto por código de servidor (cotacao.ts) quanto por componentes cliente
// (a tela do cotador reordena/filtra os resultados já recebidos sem precisar
// de mais uma chamada ao servidor).

export type DadosCotacao = {
  cepOrigem: string;
  cepDestino: string;
  pesoKg: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
  valorDeclaradoCentavos?: number;
  nomeReferencia?: string;
  observacao?: string;
};

export type OpcaoFrete = {
  id: string;
  transportadora: string;
  transportadoraLogo: string | null;
  servico: string;
  precoCentavos: number;
  precoOriginalCentavos: number | null;
  prazoDias: number | null;
  prazoMinDias: number | null;
  prazoMaxDias: number | null;
};

export type ServicoIndisponivel = {
  transportadora: string;
  servico: string;
  motivo: string;
};

export type ResultadoCotacao = {
  opcoes: OpcaoFrete[];
  indisponiveis: ServicoIndisponivel[];
};

const CEP_REGEX = /^\d{8}$/;
const PESO_MAXIMO_KG = 30;
const DIMENSAO_MAXIMA_CM = 100;

export function limparCep(cep: string): string {
  return cep.replace(/\D/g, "");
}

export function paraCentavos(valorDecimal: number): number {
  return Math.round(valorDecimal * 100);
}

export function paraReaisDecimal(centavos: number): number {
  return Math.round(centavos) / 100;
}

export function validarDadosCotacao(dados: DadosCotacao): string[] {
  const erros: string[] = [];
  const origem = limparCep(dados.cepOrigem);
  const destino = limparCep(dados.cepDestino);

  if (!CEP_REGEX.test(origem)) erros.push("CEP de origem inválido.");
  if (!CEP_REGEX.test(destino)) erros.push("CEP de destino inválido.");
  if (CEP_REGEX.test(origem) && CEP_REGEX.test(destino) && origem === destino) {
    erros.push("CEP de origem e destino não podem ser iguais.");
  }
  if (!(dados.pesoKg > 0)) erros.push("Peso deve ser maior que zero.");
  else if (dados.pesoKg > PESO_MAXIMO_KG) erros.push(`Peso acima do limite aceito (${PESO_MAXIMO_KG} kg).`);

  const dimensoes: Array<[string, number]> = [
    ["Altura", dados.alturaCm],
    ["Largura", dados.larguraCm],
    ["Comprimento", dados.comprimentoCm],
  ];
  for (const [nome, valor] of dimensoes) {
    if (!(valor > 0)) erros.push(`${nome} deve ser maior que zero.`);
    else if (valor > DIMENSAO_MAXIMA_CM) erros.push(`${nome} acima do limite aceito (${DIMENSAO_MAXIMA_CM} cm).`);
  }

  if (dados.valorDeclaradoCentavos !== undefined && dados.valorDeclaradoCentavos < 0) {
    erros.push("Valor declarado não pode ser negativo.");
  }

  return erros;
}

// Formato de requisição/resposta conforme a documentação pública do endpoint
// de cálculo do Melhor Envio (POST /api/v2/me/shipment/calculate). Reconferir
// contra a documentação oficial atual antes do primeiro teste real em
// sandbox — nomes de campo de APIs de terceiros podem mudar com o tempo.
export type RespostaCalculoItem = {
  id: number | string;
  name?: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  delivery_range?: { min?: number; max?: number };
  company?: { id?: number | string; name?: string; picture?: string };
  error?: string | null;
};

export function normalizarResposta(itens: RespostaCalculoItem[]): ResultadoCotacao {
  const opcoes: OpcaoFrete[] = [];
  const indisponiveis: ServicoIndisponivel[] = [];

  for (const item of itens) {
    const transportadora = item.company?.name ?? "Transportadora";
    const servico = item.name ?? "Serviço";

    if (item.error) {
      indisponiveis.push({ transportadora, servico, motivo: String(item.error) });
      continue;
    }

    const preco = Number(item.custom_price ?? item.price ?? 0);
    if (!Number.isFinite(preco) || preco <= 0) {
      indisponiveis.push({ transportadora, servico, motivo: "Preço não informado pela transportadora." });
      continue;
    }

    opcoes.push({
      id: String(item.id),
      transportadora,
      transportadoraLogo: item.company?.picture ?? null,
      servico,
      precoCentavos: paraCentavos(preco),
      precoOriginalCentavos: item.price !== undefined ? paraCentavos(Number(item.price)) : null,
      prazoDias: item.delivery_time ?? null,
      prazoMinDias: item.delivery_range?.min ?? null,
      prazoMaxDias: item.delivery_range?.max ?? null,
    });
  }

  return { opcoes, indisponiveis };
}

export type OrdenacaoCotacao = "menor_preco" | "menor_prazo" | "transportadora" | "custo_beneficio";

// "Custo-benefício": preço normalizado (0-1) + prazo normalizado (0-1), peso
// igual pros dois — regra simples e documentada, sem nenhuma "IA" por trás.
export function ordenarOpcoes(opcoes: OpcaoFrete[], ordenacao: OrdenacaoCotacao): OpcaoFrete[] {
  const lista = [...opcoes];
  if (ordenacao === "menor_preco") return lista.sort((a, b) => a.precoCentavos - b.precoCentavos);
  if (ordenacao === "menor_prazo") return lista.sort((a, b) => (a.prazoDias ?? 999) - (b.prazoDias ?? 999));
  if (ordenacao === "transportadora") return lista.sort((a, b) => a.transportadora.localeCompare(b.transportadora));

  const precoMax = Math.max(...lista.map((o) => o.precoCentavos), 1);
  const prazoMax = Math.max(...lista.map((o) => o.prazoDias ?? 0), 1);
  return lista.sort((a, b) => {
    const notaA = a.precoCentavos / precoMax + (a.prazoDias ?? prazoMax) / prazoMax;
    const notaB = b.precoCentavos / precoMax + (b.prazoDias ?? prazoMax) / prazoMax;
    return notaA - notaB;
  });
}
