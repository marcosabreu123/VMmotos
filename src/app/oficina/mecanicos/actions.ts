"use server";

import { revalidatePath } from "next/cache";
import { requireDono, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  criarMecanico,
  renomearMecanico,
  alterarAtivoMecanico,
  definirSocio,
  excluirMecanico,
  ErroMecanico,
} from "@/lib/oficina/mecanicos";

/**
 * Administração do cadastro de mecânicos.
 *
 * Todas as ações exigem o dono (requireDono), não apenas escrita no recurso
 * "oficina": quem é mecânico, quem é sócio e quem sai da lista é decisão do
 * dono da loja, não de operação.
 */

export type EstadoMecanico = { erro?: string };
export type ResultadoMecanico = { ok: true } | { ok: false; erro: string };

/** Converte erro de regra/permissão em mensagem; o resto continua estourando. */
async function comDono<T>(
  executar: (usuarioId: string) => Promise<T>
): Promise<{ ok: true; valor: T } | { ok: false; erro: string }> {
  try {
    const usuario = await requireDono();
    return { ok: true, valor: await executar(usuario.id) };
  } catch (erro) {
    if (erro instanceof ErroPermissao || erro instanceof ErroMecanico) {
      return { ok: false, erro: erro.message };
    }
    throw erro;
  }
}

export async function criarMecanicoAction(
  _estadoAnterior: EstadoMecanico,
  formData: FormData
): Promise<EstadoMecanico> {
  const nome = String(formData.get("nome") ?? "");
  const socioOficina = formData.get("socioOficina") === "on";

  const resultado = await comDono(async (usuarioId) => {
    const mecanico = await criarMecanico({ nome, socioOficina });
    await registrarAuditoria({
      usuarioId,
      acao: "mecanico.criar",
      entidade: "Mecanico",
      entidadeId: mecanico.id,
      detalhes: socioOficina ? `${mecanico.nome} (sócio)` : mecanico.nome,
    });
    return mecanico;
  });

  revalidatePath("/oficina/mecanicos");
  return resultado.ok ? {} : { erro: resultado.erro };
}

export async function renomearMecanicoAction(
  mecanicoId: string,
  nome: string
): Promise<ResultadoMecanico> {
  const resultado = await comDono(async (usuarioId) => {
    const mecanico = await renomearMecanico(mecanicoId, nome);
    await registrarAuditoria({
      usuarioId,
      acao: "mecanico.renomear",
      entidade: "Mecanico",
      entidadeId: mecanicoId,
      detalhes: `novo nome: ${mecanico.nome}`,
    });
  });

  revalidatePath("/oficina/mecanicos");
  return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro };
}

export async function alterarAtivoMecanicoAction(
  mecanicoId: string,
  ativo: boolean
): Promise<ResultadoMecanico> {
  const resultado = await comDono(async (usuarioId) => {
    await alterarAtivoMecanico(mecanicoId, ativo);
    await registrarAuditoria({
      usuarioId,
      acao: ativo ? "mecanico.reativar" : "mecanico.arquivar",
      entidade: "Mecanico",
      entidadeId: mecanicoId,
    });
  });

  revalidatePath("/oficina/mecanicos");
  return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro };
}

export async function definirSocioAction(
  mecanicoId: string,
  socioOficina: boolean
): Promise<ResultadoMecanico> {
  const resultado = await comDono(async (usuarioId) => {
    await definirSocio(mecanicoId, socioOficina);
    await registrarAuditoria({
      usuarioId,
      acao: socioOficina ? "mecanico.marcar_socio" : "mecanico.desmarcar_socio",
      entidade: "Mecanico",
      entidadeId: mecanicoId,
    });
  });

  revalidatePath("/oficina/mecanicos");
  return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro };
}

export async function excluirMecanicoAction(mecanicoId: string): Promise<ResultadoMecanico> {
  const resultado = await comDono(async (usuarioId) => {
    const mecanico = await excluirMecanico(mecanicoId);
    await registrarAuditoria({
      usuarioId,
      acao: "mecanico.excluir",
      entidade: "Mecanico",
      entidadeId: mecanicoId,
      detalhes: mecanico.nome,
    });
  });

  revalidatePath("/oficina/mecanicos");
  return resultado.ok ? { ok: true } : { ok: false, erro: resultado.erro };
}
