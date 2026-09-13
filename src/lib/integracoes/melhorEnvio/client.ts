import { melhorEnvioConfig, baseUrlMelhorEnvio, type AmbienteMelhorEnvio } from "./config";
import { nicho } from "@/config/nicho";

export class ErroMelhorEnvio extends Error {
  codigo: string;
  status?: number;

  constructor(codigo: string, mensagem: string, status?: number) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}

function mensagemParaStatus(status: number): string {
  switch (status) {
    case 401:
      return "A conexão com o Melhor Envio expirou. Reconecte a integração.";
    case 403:
      return "Sua conta do Melhor Envio não tem permissão para esta operação (verifique o escopo autorizado).";
    case 404:
      return "Recurso não encontrado no Melhor Envio.";
    case 422:
      return "Os dados enviados não foram aceitos pelo Melhor Envio (confira CEP, peso e dimensões).";
    case 429:
      return "Muitas requisições ao Melhor Envio em pouco tempo. Aguarde um instante e tente novamente.";
    case 500:
    case 502:
    case 503:
      return "O Melhor Envio está indisponível no momento. Tente novamente em instantes.";
    default:
      return "Não foi possível concluir a operação no Melhor Envio agora.";
  }
}

// Wrapper fino de fetch — headers, timeout, normalização de erro. Nunca loga
// o header Authorization nem o corpo da requisição (que pode conter token).
export async function chamarMelhorEnvio<T = unknown>(
  ambiente: AmbienteMelhorEnvio,
  caminho: string,
  opcoes: { metodo?: string; token?: string; corpo?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const { metodo = "GET", token, corpo, timeoutMs = 15000 } = opcoes;
  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const resposta = await fetch(`${baseUrlMelhorEnvio(ambiente)}${caminho}`, {
      method: metodo,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": melhorEnvioConfig.userAgent ?? `${nicho.negocio.nome} Cotador`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controlador.signal,
    });

    const texto = await resposta.text();
    let corpoResposta: unknown = null;
    if (texto) {
      try {
        corpoResposta = JSON.parse(texto);
      } catch {
        corpoResposta = null;
      }
    }

    if (!resposta.ok) {
      throw new ErroMelhorEnvio(`HTTP_${resposta.status}`, mensagemParaStatus(resposta.status), resposta.status);
    }

    return corpoResposta as T;
  } catch (erro) {
    if (erro instanceof ErroMelhorEnvio) throw erro;
    if (erro instanceof Error && erro.name === "AbortError") {
      throw new ErroMelhorEnvio("TIMEOUT", "O Melhor Envio demorou demais para responder. Tente novamente.");
    }
    throw new ErroMelhorEnvio("FALHA_CONEXAO", "Não foi possível conectar ao Melhor Envio agora.");
  } finally {
    clearTimeout(timeoutId);
  }
}
