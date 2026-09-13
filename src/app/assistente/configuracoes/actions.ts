"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { atualizarConfigAdmin } from "@/lib/assistente/configAdmin";
import { reaisParaCentavos } from "@/lib/money";
import { registrarAuditoria } from "@/lib/auditoria";

export type EstadoConfigAssistente = { erro?: string; sucesso?: boolean };

export async function atualizarConfigAssistenteAction(
  _estadoAnterior: EstadoConfigAssistente,
  formData: FormData
): Promise<EstadoConfigAssistente> {
  const usuario = await requireOwner();

  const habilitado = formData.get("habilitado") === "on";
  const limiteDiarioPorUsuario = Number(formData.get("limiteDiarioPorUsuario"));
  const valorAltoReais = String(formData.get("valorAlto") ?? "0");

  if (!Number.isFinite(limiteDiarioPorUsuario) || limiteDiarioPorUsuario <= 0) {
    return { erro: "Informe um limite diário válido (maior que zero)." };
  }

  const valorAltoCentavos = reaisParaCentavos(valorAltoReais);
  if (valorAltoCentavos <= 0) {
    return { erro: "Informe um valor alto válido (maior que zero)." };
  }

  await atualizarConfigAdmin({ habilitado, limiteDiarioPorUsuario, valorAltoCentavos });
  await registrarAuditoria({
    usuarioId: usuario.id,
    acao: "assistente.configurar",
    entidade: "ConfiguracaoAssistente",
    detalhes: `habilitado=${habilitado} | limiteDiario=${limiteDiarioPorUsuario} | valorAlto=${valorAltoReais}`,
  });

  revalidatePath("/assistente/configuracoes");
  return { sucesso: true };
}
