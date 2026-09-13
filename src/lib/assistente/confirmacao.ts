// Heurística determinística de confirmação/negação — nunca delega essa
// decisão ao modelo. Uma resposta vaga ("acho que sim") não deve bater em
// nenhuma das duas listas, e cai no caminho "ambíguo" do orquestrador, que
// pede confirmação de novo em vez de assumir qualquer coisa.
//
// A checagem é feita só pela PRIMEIRA palavra (sem acento/pontuação) da
// mensagem — cobre variações como "sim, confirmo", "sim!", "pode sim." sem
// precisar enumerar cada combinação de pontuação/continuação possível.

const PRIMEIRAS_PALAVRAS_AFIRMATIVAS = new Set([
  "sim",
  "confirma",
  "confirme",
  "confirmo",
  "confirmar",
  "confirmado",
  "pode",
  "prosseguir",
  "executar",
  "ok",
  "beleza",
  "isso",
  "exato",
  "correto",
  "positivo",
]);

const PRIMEIRAS_PALAVRAS_NEGATIVAS = new Set([
  "nao",
  "cancela",
  "cancele",
  "cancelar",
  "cancelado",
  "desiste",
  "desistir",
  "para",
  "esquece",
  "negativo",
  "manter",
  "mantem",
]);

function primeiraPalavra(texto: string): string {
  const semAcento = texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const encontrada = semAcento.match(/[a-z]+/);
  return encontrada ? encontrada[0] : "";
}

export function pareceConfirmacao(texto: string): boolean {
  const palavra = primeiraPalavra(texto);
  if (PRIMEIRAS_PALAVRAS_NEGATIVAS.has(palavra)) return false;
  return PRIMEIRAS_PALAVRAS_AFIRMATIVAS.has(palavra);
}

export function pareceNegacao(texto: string): boolean {
  return PRIMEIRAS_PALAVRAS_NEGATIVAS.has(primeiraPalavra(texto));
}
