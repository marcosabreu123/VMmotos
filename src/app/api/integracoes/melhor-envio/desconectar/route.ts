import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { melhorEnvioConfig } from "@/lib/integracoes/melhorEnvio/config";
import { desconectar } from "@/lib/integracoes/melhorEnvio/oauth";
import { ehAdministrador } from "@/lib/permissoes";

export async function POST() {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  if (!ehAdministrador(usuario.papel)) {
    return NextResponse.json({ erro: "Apenas o Dono pode desconectar a integração." }, { status: 403 });
  }

  await desconectar(melhorEnvioConfig.environment, usuario);
  return NextResponse.json({ ok: true });
}
