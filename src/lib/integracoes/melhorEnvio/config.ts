// Config central da integração com o Melhor Envio — nenhum outro arquivo do
// projeto deve ler process.env.MELHOR_ENVIO_* diretamente, sempre importar
// daqui (mesmo padrão de src/lib/assistente/config.ts).

export type AmbienteMelhorEnvio = "sandbox" | "production";

export const melhorEnvioConfig = {
  clientId: process.env.MELHOR_ENVIO_CLIENT_ID,
  clientSecret: process.env.MELHOR_ENVIO_CLIENT_SECRET,
  redirectUri: process.env.MELHOR_ENVIO_REDIRECT_URI,
  environment: (process.env.MELHOR_ENVIO_ENVIRONMENT === "production" ? "production" : "sandbox") as AmbienteMelhorEnvio,
  userAgent: process.env.MELHOR_ENVIO_USER_AGENT,
  // Escopo mínimo para cotação — nunca solicitar compra/etiqueta/rastreio/cancelamento.
  scopes: process.env.MELHOR_ENVIO_SCOPES ?? "shipping-calculate",
  // CEP de origem pré-preenchido no cotador (editável) — opcional.
  cepOrigemPadrao: process.env.MELHOR_ENVIO_CEP_ORIGEM_PADRAO ?? "",
};

export const MELHOR_ENVIO_BASE_URL: Record<AmbienteMelhorEnvio, string> = {
  sandbox: "https://sandbox.melhorenvio.com.br",
  production: "https://melhorenvio.com.br",
};

export function baseUrlMelhorEnvio(ambiente: AmbienteMelhorEnvio = melhorEnvioConfig.environment): string {
  return MELHOR_ENVIO_BASE_URL[ambiente];
}

export function configuracaoCompleta(): boolean {
  return Boolean(
    melhorEnvioConfig.clientId &&
      melhorEnvioConfig.clientSecret &&
      melhorEnvioConfig.redirectUri &&
      melhorEnvioConfig.userAgent
  );
}
