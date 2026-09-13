import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { melhorEnvioConfig } from "@/lib/integracoes/melhorEnvio/config";
import { testarConexao, ErroOAuthMelhorEnvio } from "@/lib/integracoes/melhorEnvio/oauth";
import { ErroMelhorEnvio } from "@/lib/integracoes/melhorEnvio/client";
import { registrarAuditoria } from "@/lib/auditoria";

export async function POST() {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  if (usuario.papel !== "OWNER") {
    return NextResponse.json({ erro: "Apenas o Dono pode testar a integração." }, { status: 403 });
  }

  try {
    await testarConexao(usuario);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "integracao.melhor_envio.testar_conexao",
      entidade: "IntegracaoMelhorEnvio",
      entidadeId: melhorEnvioConfig.environment,
      detalhes: "sucesso",
    });
    return NextResponse.json({ ok: true });
  } catch (erro) {
    const mensagem =
      erro instanceof ErroOAuthMelhorEnvio || erro instanceof ErroMelhorEnvio
        ? erro.message
        : "Não foi possível testar a conexão agora.";
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "integracao.melhor_envio.testar_conexao",
      entidade: "IntegracaoMelhorEnvio",
      entidadeId: melhorEnvioConfig.environment,
      detalhes: `falha: ${mensagem}`,
    });
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 502 });
  }
}
