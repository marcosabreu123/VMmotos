import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import type { SessaoUsuario } from "@/lib/types";
import { registrarAuditoria } from "@/lib/auditoria";
import { melhorEnvioConfig, baseUrlMelhorEnvio, type AmbienteMelhorEnvio } from "./config";
import { chamarMelhorEnvio, ErroMelhorEnvio } from "./client";
import { criptografar, descriptografar } from "./criptografia";

export class ErroOAuthMelhorEnvio extends Error {}

const STATE_VALIDADE_MS = 10 * 60 * 1000;
const RENOVAR_ANTES_MS = 5 * 60 * 1000;

type RespostaToken = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // segundos
  scope?: string;
};

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function gerarUrlAutorizacao(usuario: SessaoUsuario): Promise<string> {
  if (!melhorEnvioConfig.clientId || !melhorEnvioConfig.redirectUri) {
    throw new ErroOAuthMelhorEnvio("A integração com o Melhor Envio ainda não foi configurada (faltam variáveis de ambiente).");
  }

  const state = randomBytes(32).toString("hex");
  await prisma.melhorEnvioOAuthState.create({
    data: {
      state,
      usuarioId: usuario.id,
      ambiente: melhorEnvioConfig.environment,
      expiresAt: new Date(Date.now() + STATE_VALIDADE_MS),
    },
  });

  const url = new URL(`${baseUrlMelhorEnvio()}/oauth/authorize`);
  url.searchParams.set("client_id", melhorEnvioConfig.clientId);
  url.searchParams.set("redirect_uri", melhorEnvioConfig.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", melhorEnvioConfig.scopes);
  url.searchParams.set("state", state);
  return url.toString();
}

async function salvarTokens(ambiente: AmbienteMelhorEnvio, resposta: RespostaToken, usuarioId: string) {
  const expiresAt = new Date(Date.now() + resposta.expires_in * 1000);
  const dados = {
    status: "conectado",
    accessToken: criptografar(resposta.access_token),
    refreshToken: criptografar(resposta.refresh_token),
    tokenType: resposta.token_type,
    scopes: resposta.scope ?? melhorEnvioConfig.scopes,
    expiresAt,
    connectedAt: new Date(),
    connectedById: usuarioId,
    refreshedAt: new Date(),
  };
  await prisma.integracaoMelhorEnvio.upsert({
    where: { ambiente },
    create: { ambiente, ...dados },
    update: dados,
  });
}

// Valida o state (existe, não expirado, não usado, pertence ao usuário atual)
// e marca como usado ATOMICAMENTE antes de trocar o código — evita replay e
// corrida caso o callback seja disparado duas vezes.
async function validarEConsumirState(state: string, usuario: SessaoUsuario) {
  const registro = await prisma.melhorEnvioOAuthState.findUnique({ where: { state } });
  if (!registro) throw new ErroOAuthMelhorEnvio("Link de autorização inválido.");
  if (registro.usedAt) throw new ErroOAuthMelhorEnvio("Este link de autorização já foi utilizado.");
  if (registro.expiresAt < new Date()) throw new ErroOAuthMelhorEnvio("Este link de autorização expirou. Tente conectar novamente.");
  if (registro.usuarioId !== usuario.id) throw new ErroOAuthMelhorEnvio("Sessão não corresponde à solicitação original.");

  const consumo = await prisma.melhorEnvioOAuthState.updateMany({
    where: { id: registro.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumo.count !== 1) throw new ErroOAuthMelhorEnvio("Este link de autorização já foi utilizado.");

  return registro.ambiente as AmbienteMelhorEnvio;
}

export async function processarCallback(params: { code: string; state: string; usuario: SessaoUsuario }): Promise<void> {
  if (!melhorEnvioConfig.clientId || !melhorEnvioConfig.clientSecret || !melhorEnvioConfig.redirectUri) {
    throw new ErroOAuthMelhorEnvio("A integração com o Melhor Envio ainda não foi configurada.");
  }

  const ambiente = await validarEConsumirState(params.state, params.usuario);

  const resposta = await chamarMelhorEnvio<RespostaToken>(ambiente, "/oauth/token", {
    metodo: "POST",
    corpo: {
      grant_type: "authorization_code",
      client_id: melhorEnvioConfig.clientId,
      client_secret: melhorEnvioConfig.clientSecret,
      redirect_uri: melhorEnvioConfig.redirectUri,
      code: params.code,
    },
  });

  await salvarTokens(ambiente, resposta, params.usuario.id);

  await registrarAuditoria({
    usuarioId: params.usuario.id,
    acao: "integracao.melhor_envio.conectar",
    entidade: "IntegracaoMelhorEnvio",
    entidadeId: ambiente,
    detalhes: `Ambiente: ${ambiente}`,
  });
}

async function tentarObterLockRenovacao(ambiente: AmbienteMelhorEnvio): Promise<boolean> {
  const resultado = await prisma.integracaoMelhorEnvio.updateMany({
    where: { ambiente, status: "conectado" },
    data: { status: "renovando" },
  });
  return resultado.count === 1;
}

async function renovarToken(
  ambiente: AmbienteMelhorEnvio,
  refreshTokenCriptografado: string | null,
  usuario: SessaoUsuario
): Promise<string> {
  const obtidoLock = await tentarObterLockRenovacao(ambiente);

  if (!obtidoLock) {
    // outra requisição pode estar renovando agora, ou a integração não está
    // conectada — espera um instante e relê em vez de tentar renovar de novo.
    await esperar(1500);
    let atual = await prisma.integracaoMelhorEnvio.findUnique({ where: { ambiente } });
    if (atual?.status === "renovando") {
      await esperar(1500);
      atual = await prisma.integracaoMelhorEnvio.findUnique({ where: { ambiente } });
    }
    if (atual?.status === "conectado" && atual.accessToken) {
      return descriptografar(atual.accessToken);
    }
    throw new ErroOAuthMelhorEnvio("Integração com o Melhor Envio não está conectada. Reconecte para continuar.");
  }

  try {
    if (!refreshTokenCriptografado) {
      throw new ErroOAuthMelhorEnvio("Integração precisa ser reconectada.");
    }
    const refreshTokenPlano = descriptografar(refreshTokenCriptografado);

    const resposta = await chamarMelhorEnvio<RespostaToken>(ambiente, "/oauth/token", {
      metodo: "POST",
      corpo: {
        grant_type: "refresh_token",
        client_id: melhorEnvioConfig.clientId,
        client_secret: melhorEnvioConfig.clientSecret,
        refresh_token: refreshTokenPlano,
      },
    });

    const expiresAt = new Date(Date.now() + resposta.expires_in * 1000);
    await prisma.integracaoMelhorEnvio.update({
      where: { ambiente },
      data: {
        status: "conectado",
        accessToken: criptografar(resposta.access_token),
        refreshToken: criptografar(resposta.refresh_token),
        expiresAt,
        refreshedAt: new Date(),
      },
    });

    return resposta.access_token;
  } catch (erro) {
    // Nunca tenta renovar infinitamente — marca como "precisa reconectar" e
    // deixa a decisão de tentar de novo para uma ação explícita do usuário.
    await prisma.integracaoMelhorEnvio
      .update({ where: { ambiente }, data: { status: "reconexao_necessaria" } })
      .catch(() => {});
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "integracao.melhor_envio.token_renovacao_falhou",
      entidade: "IntegracaoMelhorEnvio",
      entidadeId: ambiente,
      detalhes: erro instanceof Error ? erro.message : "erro desconhecido",
    });
    if (erro instanceof ErroMelhorEnvio || erro instanceof ErroOAuthMelhorEnvio) throw erro;
    throw new ErroOAuthMelhorEnvio("Falha ao renovar a conexão com o Melhor Envio.");
  }
}

/** Retorna um access token válido, renovando antecipadamente se necessário. */
export async function obterTokenValido(
  usuario: SessaoUsuario,
  ambiente: AmbienteMelhorEnvio = melhorEnvioConfig.environment
): Promise<string> {
  const integracao = await prisma.integracaoMelhorEnvio.findUnique({ where: { ambiente } });
  if (!integracao || integracao.status === "desconectado" || !integracao.accessToken) {
    throw new ErroOAuthMelhorEnvio("Integração com o Melhor Envio não está conectada.");
  }
  if (integracao.status === "reconexao_necessaria") {
    throw new ErroOAuthMelhorEnvio("A conexão com o Melhor Envio precisa ser refeita. Reconecte a integração.");
  }

  const restanteMs = integracao.expiresAt ? integracao.expiresAt.getTime() - Date.now() : 0;
  if (restanteMs > RENOVAR_ANTES_MS) {
    return descriptografar(integracao.accessToken);
  }

  return renovarToken(ambiente, integracao.refreshToken, usuario);
}

export type StatusIntegracao = {
  ambiente: AmbienteMelhorEnvio;
  status: string;
  conectadoEm: Date | null;
  conectadoPorNome: string | null;
  renovadoEm: Date | null;
  expiraEm: Date | null;
  configurada: boolean;
};

export async function obterStatusIntegracao(
  ambiente: AmbienteMelhorEnvio = melhorEnvioConfig.environment
): Promise<StatusIntegracao> {
  const integracao = await prisma.integracaoMelhorEnvio.findUnique({
    where: { ambiente },
    include: { connectedBy: true },
  });

  return {
    ambiente,
    status: integracao?.status ?? "desconectado",
    conectadoEm: integracao?.connectedAt ?? null,
    conectadoPorNome: integracao?.connectedBy?.nome ?? null,
    renovadoEm: integracao?.refreshedAt ?? null,
    expiraEm: integracao?.expiresAt ?? null,
    configurada: Boolean(melhorEnvioConfig.clientId && melhorEnvioConfig.clientSecret && melhorEnvioConfig.redirectUri),
  };
}

export async function desconectar(ambiente: AmbienteMelhorEnvio, usuario: SessaoUsuario): Promise<void> {
  await prisma.integracaoMelhorEnvio.updateMany({
    where: { ambiente },
    data: { status: "desconectado", accessToken: null, refreshToken: null, expiresAt: null },
  });
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "integracao.melhor_envio.desconectar",
    entidade: "IntegracaoMelhorEnvio",
    entidadeId: ambiente,
  });
}

export async function testarConexao(
  usuario: SessaoUsuario,
  ambiente: AmbienteMelhorEnvio = melhorEnvioConfig.environment
): Promise<unknown> {
  const token = await obterTokenValido(usuario, ambiente);
  return chamarMelhorEnvio(ambiente, "/api/v2/me", { token });
}
