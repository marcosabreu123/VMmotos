import { reaisParaCentavos } from "@/lib/money";

// Conversor best-effort de número/valor por extenso em pt-BR para inteiro.
// Não é uma NLU completa — cobre os casos mais comuns de fala ("duzentos e
// cinquenta", "meia dúzia"). Quando o modelo já manda o valor em dígitos
// ("199,90", que é o caso mais comum vindo da transcrição/digitação), o
// caminho rápido de reaisParaCentavos/parseInt cobre isso sem passar por aqui.

const UNIDADES: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  "três": 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
};

const DEZ_A_DEZENOVE: Record<string, number> = {
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
};

const DEZENAS: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
};

const CENTENAS: Record<string, number> = {
  cem: 100,
  cento: 100,
  duzentos: 200,
  trezentos: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
};

const EXPRESSOES_ESPECIAIS: Record<string, number> = {
  "meia duzia": 6,
  "meia dúzia": 6,
  duzia: 12,
  "dúzia": 12,
};

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Converte um número por extenso em pt-BR (ex: "duzentos e cinquenta") num inteiro. */
export function palavraParaNumero(texto: string): number | null {
  const normalizado = normalizar(texto);
  if (normalizado in EXPRESSOES_ESPECIAIS) return EXPRESSOES_ESPECIAIS[normalizado];

  // número já em dígitos
  if (/^\d+$/.test(normalizado)) return Number(normalizado);

  const tokens = normalizado.split(/\s+e\s+|\s+/).filter((t) => t && t !== "e");
  if (tokens.length === 0) return null;

  let total = 0;
  let encontrouAlgo = false;

  for (const token of tokens) {
    if (token === "mil") {
      total = (total || 1) * 1000;
      encontrouAlgo = true;
      continue;
    }
    if (token === "milhao" || token === "milhão" || token === "milhoes" || token === "milhões") {
      total = (total || 1) * 1_000_000;
      encontrouAlgo = true;
      continue;
    }
    if (token in CENTENAS) {
      total += CENTENAS[token];
      encontrouAlgo = true;
    } else if (token in DEZENAS) {
      total += DEZENAS[token];
      encontrouAlgo = true;
    } else if (token in DEZ_A_DEZENOVE) {
      total += DEZ_A_DEZENOVE[token];
      encontrouAlgo = true;
    } else if (token in UNIDADES) {
      total += UNIDADES[token];
      encontrouAlgo = true;
    }
    // palavras não reconhecidas ("reais", "unidades"...) são ignoradas aqui —
    // quem chama já deve ter separado o texto relevante antes de passar.
  }

  return encontrouAlgo ? total : null;
}

/**
 * Converte um valor em dinheiro falado/escrito em pt-BR para centavos
 * (inteiro). Tenta primeiro o caminho rápido (dígitos, com vírgula ou ponto
 * decimal); só cai no parser por extenso se não for um número literal.
 */
export function valorParaCentavos(texto: string): number | null {
  const normalizado = normalizar(texto);

  const somenteDigitos = normalizado.replace(/[^\d.,]/g, "");
  if (somenteDigitos && /^\d[\d.,]*$/.test(somenteDigitos)) {
    return reaisParaCentavos(somenteDigitos);
  }

  const semSufixos = normalizado.replace(/reais?/g, "").replace(/centavos?/g, "").trim();
  const partes = semSufixos.split(/\s+e\s+(?=\w*(centavo)?$)/);

  // caso mais comum falado: "<inteiro> reais [e <centavos> centavos]" já foi
  // higienizado acima; tenta o texto inteiro primeiro, depois cada metade.
  const valorInteiro = palavraParaNumero(semSufixos);
  if (valorInteiro !== null && !normalizado.includes("centavo")) {
    return valorInteiro * 100;
  }

  if (partes.length === 2) {
    const reais = palavraParaNumero(partes[0]);
    const centavos = palavraParaNumero(partes[1]);
    if (reais !== null && centavos !== null) {
      return reais * 100 + centavos;
    }
  }

  return valorInteiro !== null ? valorInteiro * 100 : null;
}
