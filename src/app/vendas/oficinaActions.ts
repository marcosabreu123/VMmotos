"use server";

import { revalidatePath } from "next/cache";
import { requireEscrita, ErroPermissao } from "@/lib/permissoes-servidor";
import { registrarAuditoria } from "@/lib/auditoria";
import { criarTipoServico, ErroTipoServico } from "@/lib/oficina/tiposServico";
import { criarMoto, buscarMotoPorPlaca, formatarPlaca, ErroMoto } from "@/lib/motos";

/**
 * Cadastros rápidos disparados de dentro da venda.
 *
 * A venda não pode parar para o dono ir cadastrar a moto ou o tipo de serviço
 * em outra tela e voltar — é no balcão, com o cliente esperando.
 */

export type ResultadoTipoServico =
  | { ok: true; tipo: { id: string; nome: string } }
  | { ok: false; erro: string };

export async function criarTipoServicoAction(nome: string): Promise<ResultadoTipoServico> {
  let usuario;
  try {
    usuario = await requireEscrita("oficina");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    throw erro;
  }

  try {
    const tipo = await criarTipoServico(nome);
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "tipo_servico.criar",
      entidade: "TipoServico",
      entidadeId: tipo.id,
      detalhes: tipo.nome,
    });
    revalidatePath("/vendas/nova");
    return { ok: true, tipo: { id: tipo.id, nome: tipo.nome } };
  } catch (erro) {
    if (erro instanceof ErroTipoServico) return { ok: false, erro: erro.message };
    throw erro;
  }
}

export type ResultadoMoto =
  | { ok: true; moto: { id: string; placa: string; modelo: string | null }; jaExistia: boolean }
  | { ok: false; erro: string };

/**
 * Localiza a moto pela placa e cadastra se ainda não existir.
 *
 * Uma coisa só de propósito: no balcão o dono digita a placa sem saber (nem
 * precisar saber) se aquela moto já passou por lá. Placa repetida não é erro
 * aqui — é a moto voltando, que é justamente o que dá o histórico.
 */
export async function acharOuCriarMotoAction(
  placa: string,
  modelo?: string
): Promise<ResultadoMoto> {
  let usuario;
  try {
    usuario = await requireEscrita("motos");
  } catch (erro) {
    if (erro instanceof ErroPermissao) return { ok: false, erro: erro.message };
    throw erro;
  }

  try {
    const existente = await buscarMotoPorPlaca(placa);
    if (existente) {
      return {
        ok: true,
        moto: { id: existente.id, placa: existente.placa, modelo: existente.modelo },
        jaExistia: true,
      };
    }

    const moto = await criarMoto({ placa, modelo });
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "moto.criar",
      entidade: "Moto",
      entidadeId: moto.id,
      detalhes: `${formatarPlaca(moto.placa)} — cadastrada na venda`,
    });
    revalidatePath("/motos");

    return {
      ok: true,
      moto: { id: moto.id, placa: moto.placa, modelo: moto.modelo },
      jaExistia: false,
    };
  } catch (erro) {
    if (erro instanceof ErroMoto) return { ok: false, erro: erro.message };
    throw erro;
  }
}
