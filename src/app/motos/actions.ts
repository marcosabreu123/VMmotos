"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { criarMoto, ErroMoto, formatarPlaca } from "@/lib/motos";

export type EstadoMoto = { erro?: string };

export async function criarMotoAction(
  _estadoAnterior: EstadoMoto,
  formData: FormData
): Promise<EstadoMoto> {
  let usuario;
  try {
    usuario = await requireEscrita("motos");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { erro: erro.message };
    throw erro;
  }

  const placa = String(formData.get("placa") ?? "");
  const modelo = String(formData.get("modelo") ?? "");
  const observacoes = String(formData.get("observacoes") ?? "");

  try {
    const moto = await criarMoto({ placa, modelo, observacoes });

    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "moto.criar",
      entidade: "Moto",
      entidadeId: moto.id,
      detalhes: formatarPlaca(moto.placa),
    });

    revalidatePath("/motos");
    return {};
  } catch (erro) {
    // Erro de regra (placa inválida, placa repetida) é recado para o usuário,
    // não falha de sistema — volta como mensagem no formulário.
    if (erro instanceof ErroMoto) return { erro: erro.message };
    throw erro;
  }
}
