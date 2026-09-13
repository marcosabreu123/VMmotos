import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import { podeLer, podeEscrever, ErroPermissao, type Recurso } from "./permissoes";
import type { SessaoUsuario } from "./types";

export { ErroPermissao };

// Para usar dentro de server actions que escrevem — lança ErroPermissao
// (o catch de cada action já sabe devolver a mensagem como erro amigável).
export async function requireEscrita(recurso: Recurso): Promise<SessaoUsuario> {
  const usuario = await requireUser();
  if (!podeEscrever(usuario, recurso)) {
    throw new ErroPermissao("Você não tem permissão para realizar esta ação.");
  }
  return usuario;
}

// Para usar no topo de páginas (Server Components) que exigem ao menos leitura do recurso.
export async function requireLeitura(recurso: Recurso): Promise<SessaoUsuario> {
  const usuario = await requireUser();
  if (!podeLer(usuario, recurso)) {
    redirect("/dashboard");
  }
  return usuario;
}
