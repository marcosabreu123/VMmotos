"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import {
  criarMecanico,
  alterarAtivoMecanico,
  definirSocio,
  ErroMecanico,
} from "@/lib/oficina/mecanicos";

export type EstadoMecanico = { erro?: string };

export async function criarMecanicoAction(
  _estadoAnterior: EstadoMecanico,
  formData: FormData
): Promise<EstadoMecanico> {
  let usuario;
  try {
    usuario = await requireEscrita("oficina");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const nome = String(formData.get("nome") ?? "");
  const socioOficina = formData.get("socioOficina") === "on";

  try {
    const mecanico = await criarMecanico({ nome, socioOficina });

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "mecanico.criar",
      entidade: "Mecanico",
      entidadeId: mecanico.id,
      detalhes: socioOficina ? `${mecanico.nome} (sócio)` : mecanico.nome,
    });

    revalidatePath("/oficina/mecanicos");
    return {};
  } catch (erro) {
    if (erro instanceof ErroMecanico) return { erro: erro.message };
    throw erro;
  }
}

export async function alterarAtivoMecanicoAction(mecanicoId: string, ativo: boolean) {
  const usuario = await requireEscrita("oficina");
  await alterarAtivoMecanico(mecanicoId, ativo);

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: ativo ? "mecanico.reativar" : "mecanico.arquivar",
    entidade: "Mecanico",
    entidadeId: mecanicoId,
  });

  revalidatePath("/oficina/mecanicos");
}

export async function definirSocioAction(mecanicoId: string, socioOficina: boolean) {
  const usuario = await requireEscrita("oficina");
  await definirSocio(mecanicoId, socioOficina);

  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: socioOficina ? "mecanico.marcar_socio" : "mecanico.desmarcar_socio",
    entidade: "Mecanico",
    entidadeId: mecanicoId,
  });

  revalidatePath("/oficina/mecanicos");
}
