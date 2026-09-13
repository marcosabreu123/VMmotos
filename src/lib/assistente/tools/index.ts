import type { SessaoUsuario } from "@/lib/types";
import { podeLer, podeEscrever, podeVerCustos } from "@/lib/permissoes";
import type { FerramentaAssistente, ToolResultado } from "../types";
import { ferramentasConsulta } from "./consultas";
import { ferramentasEscrita } from "./escrita";

const TODAS_FERRAMENTAS: FerramentaAssistente[] = [...ferramentasConsulta, ...ferramentasEscrita];

function usuarioTemPermissao(usuario: SessaoUsuario, ferramenta: FerramentaAssistente): boolean {
  const temAcessoRecurso = ferramenta.exigeEscrita
    ? podeEscrever(usuario, ferramenta.recurso)
    : podeLer(usuario, ferramenta.recurso);
  if (!temAcessoRecurso) return false;
  if (ferramenta.exigeVerCustos && !podeVerCustos(usuario.papel)) return false;
  return true;
}

/**
 * Ferramentas disponíveis para este usuário — camada 1 de permissão: o que o
 * papel não pode usar nem é oferecido ao modelo (nem tenta, nem aparece).
 */
export function ferramentasParaUsuario(usuario: SessaoUsuario): FerramentaAssistente[] {
  return TODAS_FERRAMENTAS.filter((ferramenta) => usuarioTemPermissao(usuario, ferramenta));
}

/**
 * Executa uma ferramenta pelo nome — camada 2 de permissão: reconfere de
 * novo no servidor, nunca confiando que "só foi oferecida ferramenta
 * permitida" (o modelo pode alucinar um nome de ferramenta que nunca viu).
 */
export async function executarFerramenta(
  nome: string,
  args: Record<string, unknown>,
  usuario: SessaoUsuario
): Promise<ToolResultado> {
  const ferramenta = TODAS_FERRAMENTAS.find((f) => f.nome === nome);
  if (!ferramenta) {
    return { success: false, error_code: "FERRAMENTA_DESCONHECIDA", message: "Ferramenta não reconhecida." };
  }
  if (!usuarioTemPermissao(usuario, ferramenta)) {
    return {
      success: false,
      error_code: "SEM_PERMISSAO",
      message: "Você não tem permissão para usar esta ferramenta.",
    };
  }

  try {
    return await ferramenta.handler(args, usuario);
  } catch (erro) {
    return {
      success: false,
      error_code: "ERRO_INTERNO",
      message: erro instanceof Error ? erro.message : "Erro inesperado ao executar a ferramenta.",
    };
  }
}

export function buscarFerramenta(nome: string): FerramentaAssistente | undefined {
  return TODAS_FERRAMENTAS.find((f) => f.nome === nome);
}

/**
 * Reconfere permissão para um nome de ferramenta específico — usado pelo
 * orquestrador antes de rodar um executor de escrita (Fase 2), no
 * curto-circuito determinístico que não passa pelo handler acima.
 */
export function usuarioTemPermissaoParaFerramenta(usuario: SessaoUsuario, nomeFerramenta: string): boolean {
  const ferramenta = TODAS_FERRAMENTAS.find((f) => f.nome === nomeFerramenta);
  if (!ferramenta) return false;
  return usuarioTemPermissao(usuario, ferramenta);
}
