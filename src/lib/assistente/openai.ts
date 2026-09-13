import OpenAI from "openai";
import { assistenteConfig, ErroAssistente } from "./config";
import type { FerramentaAssistente } from "./types";

let client: OpenAI | null = null;

function obterClient(): OpenAI {
  if (!assistenteConfig.apiKey) {
    throw new ErroAssistente("CONFIG_AUSENTE", "Assistente de IA não está configurado (OPENAI_API_KEY ausente).");
  }
  if (!client) {
    client = new OpenAI({ apiKey: assistenteConfig.apiKey });
  }
  return client;
}

export type MensagemChat = OpenAI.Chat.Completions.ChatCompletionMessageParam;
// Só registramos ferramentas do tipo "function" (nunca "custom") — o filtro em
// chamarModelo() abaixo garante que só esse tipo chega no restante do código.
export type ToolCallResposta = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;

function paraFerramentaOpenAI(ferramenta: FerramentaAssistente): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name: ferramenta.nome,
      description: ferramenta.descricao,
      parameters: ferramenta.parametros,
    },
  };
}

export type RespostaModelo = {
  texto: string | null;
  toolCalls: ToolCallResposta[];
};

export async function chamarModelo(
  mensagens: MensagemChat[],
  ferramentas: FerramentaAssistente[]
): Promise<RespostaModelo> {
  const openai = obterClient();

  const resposta = await openai.chat.completions.create({
    model: assistenteConfig.model,
    messages: mensagens,
    tools: ferramentas.map(paraFerramentaOpenAI),
    tool_choice: "auto",
  });

  const escolha = resposta.choices[0];
  const toolCalls = (escolha?.message?.tool_calls ?? []).filter(
    (chamada): chamada is ToolCallResposta => chamada.type === "function"
  );
  return {
    texto: escolha?.message?.content ?? null,
    toolCalls,
  };
}

// Transcrição em memória — o arquivo de áudio nunca é persistido no Supabase
// Storage nem em disco, só passa direto pro endpoint da OpenAI e é descartado.
export async function transcreverAudio(arquivo: File): Promise<string> {
  const openai = obterClient();
  const resposta = await openai.audio.transcriptions.create({
    file: arquivo,
    model: assistenteConfig.transcriptionModel,
    language: "pt",
  });
  return resposta.text;
}
