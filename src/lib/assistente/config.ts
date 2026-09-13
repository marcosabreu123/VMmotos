// Config central do assistente de IA — nenhum outro arquivo do projeto deve
// ler process.env.OPENAI_*/ASSISTENTE_* diretamente, sempre importar daqui.
// Assim trocar de modelo (ou desligar o assistente) é uma variável de
// ambiente, nunca uma mudança de código espalhada por vários arquivos.
export const assistenteConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_ASSISTANT_MODEL ?? "gpt-5-mini",
  transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1",
  timezone: process.env.ASSISTENTE_TIMEZONE ?? "America/Sao_Paulo",
  dailyLimitPerUser: Number(process.env.ASSISTENTE_LIMITE_DIARIO ?? 200),
  enabled: process.env.ASSISTENTE_HABILITADO !== "false",
  audioMaxSegundos: Number(process.env.ASSISTENTE_AUDIO_MAX_SEGUNDOS ?? 60),
  audioMaxBytes: Number(process.env.ASSISTENTE_AUDIO_MAX_BYTES ?? 8 * 1024 * 1024),
};

export class ErroAssistente extends Error {
  codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
  }
}
