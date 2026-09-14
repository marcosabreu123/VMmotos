import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { construirSystemPrompt } from "./prompt";
import { chamarModelo, type MensagemChat } from "./openai";
import { ferramentasParaUsuario, executarFerramenta, usuarioTemPermissaoParaFerramenta, buscarFerramenta } from "./tools";
import { executores } from "./executores";
import { pareceConfirmacao, pareceNegacao } from "./confirmacao";
import { registrarInteracaoAssistente } from "./auditoria-assistente";
import { buscarInteracaoPorRequestId } from "./idempotencia";
import { listarHistoricoConversa, buscarConversaDoUsuario } from "./conversas";
import { obterConfigAdmin } from "./configAdmin";
import type { ProcessarMensagemParams, ProcessarMensagemResultado, ToolResultado } from "./types";

// Uma venda de 7 itens precisa de uma busca por produto antes da prévia, então
// 4 rodadas estouravam no meio e o turno morria sem resposta útil.
const MAX_CHAMADAS_FERRAMENTA_POR_TURNO = 10;
const PREVIEW_VALIDADE_MS = 15 * 60 * 1000;

async function limiteDiarioExcedido(usuarioId: string, limite: number): Promise<boolean> {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);
  const quantidade = await prisma.assistenteInteracao.count({
    where: { usuarioId, createdAt: { gte: inicioDoDia } },
  });
  return quantidade >= limite;
}

// Sanitiza o log da interação para JSON puro (Date -> string ISO etc.) antes
// de gravar no campo Json do Prisma, que não aceita valores não-serializáveis.
function paraJsonSeguro(valor: unknown): unknown {
  return JSON.parse(JSON.stringify(valor));
}

// A falha do provedor de IA vira uma frase que diz o que fazer. "Tente de novo
// em instantes" para um problema de crédito ou de chave faz o dono ficar
// tentando sem saber que o assistente não vai voltar sozinho.
function mensagemDeFalha(erro: string): string {
  const e = erro.toLowerCase();
  if (e.includes("no credits") || e.includes("insufficient_quota") || e.includes("exceeded your current quota")) {
    return "O assistente está sem créditos na OpenAI. Adicione créditos em platform.openai.com (Settings → Billing) que ele volta a funcionar — o resto do sistema segue normal.";
  }
  if (e.includes("incorrect api key") || e.includes("invalid_api_key") || e.includes("401")) {
    return "A chave da OpenAI não está sendo aceita. Gere uma nova em platform.openai.com e atualize a variável OPENAI_API_KEY — o resto do sistema segue normal.";
  }
  if (e.includes("rate limit") || e.includes("429")) {
    return "Muitas mensagens em pouco tempo para o serviço de IA. Espere alguns segundos e tente de novo.";
  }
  if (e.includes("timeout") || e.includes("etimedout") || e.includes("econnreset")) {
    return "A resposta do serviço de IA demorou demais. Tente de novo — se for um pedido grande, pode ajudar quebrá-lo em partes.";
  }
  return "Não foi possível processar sua mensagem no momento. Tente novamente em instantes.";
}

async function limparPreviewPendente(conversaId: string) {
  await prisma.assistenteConversa.update({
    where: { id: conversaId },
    data: { previewFerramenta: null, previewArgs: Prisma.DbNull, previewCriadoEm: null, updatedAt: new Date() },
  });
}

/**
 * Toma posse da prévia pendente ANTES de executá-la.
 *
 * O `updateMany` com a condição `previewFerramenta: nome` é atômico no banco:
 * de dois "confirmar" que cheguem juntos, exatamente um recebe count 1 e
 * executa; o outro recebe 0 e para.
 *
 * Antes disto a prévia era limpa DEPOIS de executar, e a janela entre ler e
 * limpar era suficiente para um clique duplo, ou um retry de rede, lançar a
 * mesma venda (ou despesa) duas vezes. A idempotência por requestId não
 * cobria: cada clique gera um requestId novo.
 */
async function reivindicarPreviewPendente(conversaId: string, nomeFerramenta: string): Promise<boolean> {
  const resultado = await prisma.assistenteConversa.updateMany({
    where: { id: conversaId, previewFerramenta: nomeFerramenta },
    data: { previewFerramenta: null, previewArgs: Prisma.DbNull, previewCriadoEm: null, updatedAt: new Date() },
  });
  return resultado.count === 1;
}

export async function processarMensagem(params: ProcessarMensagemParams): Promise<ProcessarMensagemResultado> {
  const { usuario, conversaId, texto, origemEntrada, transcricao, requestId } = params;

  const configAdmin = await obterConfigAdmin();
  if (!configAdmin.habilitado) {
    return { resposta: "O assistente de IA está desativado no momento.", estado: "erro" };
  }

  const textoLimpo = texto.trim();
  if (!textoLimpo) {
    return { resposta: "Não recebi nenhuma mensagem. Pode tentar de novo?", estado: "erro" };
  }

  // Idempotência — clique duplicado, atualização de página ou retry de rede
  // não devem reprocessar a mesma mensagem.
  const existente = await buscarInteracaoPorRequestId(requestId);
  if (existente) {
    const resultado = existente.resultadoJson as { resposta?: string } | null;
    return { resposta: resultado?.resposta ?? "Esta ação já havia sido concluída.", estado: "concluido" };
  }

  const conversa = await buscarConversaDoUsuario(conversaId, usuario.id);
  if (!conversa) {
    return { resposta: "Conversa não encontrada.", estado: "erro" };
  }

  if (await limiteDiarioExcedido(usuario.id, configAdmin.limiteDiarioPorUsuario)) {
    return { resposta: "Limite diário de mensagens do assistente atingido. Tente novamente amanhã.", estado: "erro" };
  }

  // ---------- Curto-circuito determinístico de confirmação (Fase 2) ----------
  // Nunca deixa o modelo decidir se uma ação de escrita deve ser executada —
  // se há uma prévia pendente nesta conversa, a decisão de confirmar/cancelar
  // é tomada aqui, por uma heurística fixa, antes de qualquer chamada à IA.
  if (conversa.previewFerramenta && conversa.previewCriadoEm) {
    const expirada = Date.now() - conversa.previewCriadoEm.getTime() > PREVIEW_VALIDADE_MS;

    if (expirada) {
      await limparPreviewPendente(conversaId);
    } else if (pareceNegacao(textoLimpo)) {
      await limparPreviewPendente(conversaId);
      await registrarInteracaoAssistente({
        usuarioId: usuario.id,
        conversaId,
        requestId,
        mensagemOriginal: textoLimpo,
        tipoEntrada: origemEntrada,
        transcricao: transcricao ?? null,
        resultadoJson: paraJsonSeguro({ resposta: "Operação cancelada." }) as Prisma.InputJsonValue,
      });
      return { resposta: "Operação cancelada.", estado: "concluido", aguardandoConfirmacao: false };
    } else if (pareceConfirmacao(textoLimpo)) {
      const nomeFerramenta = conversa.previewFerramenta;

      if (!usuarioTemPermissaoParaFerramenta(usuario, nomeFerramenta)) {
        await limparPreviewPendente(conversaId);
        return { resposta: "Você não tem mais permissão para confirmar essa ação.", estado: "erro" };
      }

      const executor = executores[nomeFerramenta];
      const argsPendentes = (conversa.previewArgs as Record<string, unknown>) ?? {};

      // Toma posse da prévia ANTES de executar. Se outro pedido já tomou (dois
      // "confirmar" simultâneos), este para aqui em vez de lançar de novo.
      const souEu = await reivindicarPreviewPendente(conversaId, nomeFerramenta);
      if (!souEu) {
        await registrarInteracaoAssistente({
          usuarioId: usuario.id,
          conversaId,
          requestId,
          mensagemOriginal: textoLimpo,
          tipoEntrada: origemEntrada,
          transcricao: transcricao ?? null,
          resultadoJson: paraJsonSeguro({ resposta: "Confirmação duplicada ignorada." }) as Prisma.InputJsonValue,
        });
        return {
          resposta: "Essa ação já foi confirmada — não lancei de novo.",
          estado: "concluido",
          aguardandoConfirmacao: false,
        };
      }

      let resultado: ToolResultado;
      if (!executor) {
        resultado = { success: false, error_code: "PREVIEW_EXPIRADA", message: "Não encontrei mais essa prévia — peça de novo, por favor." };
      } else {
        try {
          resultado = await executor(argsPendentes, usuario, conversaId);
        } catch (erro) {
          resultado = {
            success: false,
            error_code: "ERRO_INTERNO",
            message: erro instanceof Error ? erro.message : "Erro inesperado ao executar a ação.",
          };
        }
      }

      // A prévia já foi limpa na reivindicação, acima.
      await registrarInteracaoAssistente({
        usuarioId: usuario.id,
        conversaId,
        requestId,
        mensagemOriginal: textoLimpo,
        tipoEntrada: origemEntrada,
        transcricao: transcricao ?? null,
        ferramenta: nomeFerramenta,
        argumentosJson: paraJsonSeguro(argsPendentes) as Prisma.InputJsonValue,
        resultadoJson: paraJsonSeguro({ resposta: resultado.message, resultado }) as Prisma.InputJsonValue,
        erro: resultado.success ? null : resultado.message,
      });

      return { resposta: resultado.message, estado: resultado.success ? "concluido" : "erro", aguardandoConfirmacao: false };
    }
    // ambíguo: segue pro fluxo normal do modelo — o system prompt já avisa
    // que há uma prévia pendente, então o modelo pode tanto pedir uma
    // confirmação mais clara quanto atender a um pedido novo do usuário.
  }

  const ferramentas = ferramentasParaUsuario(usuario);
  const historico = await listarHistoricoConversa(conversaId, 10);

  const mensagens: MensagemChat[] = [
    { role: "system", content: construirSystemPrompt(usuario, { previewPendente: conversa.previewFerramenta }) },
  ];
  for (const linha of historico) {
    mensagens.push({ role: "user", content: linha.mensagemOriginal });
    const resultadoAnterior = linha.resultadoJson as { resposta?: string } | null;
    if (resultadoAnterior?.resposta) {
      mensagens.push({ role: "assistant", content: resultadoAnterior.resposta });
    }
  }
  mensagens.push({ role: "user", content: textoLimpo });

  const ferramentasChamadas: Array<{ nome: string; args: Record<string, unknown>; resultado: ToolResultado }> = [];
  let respostaFinal = "";
  let erroFinal: string | null = null;
  let estourouLimite = false;

  try {
    for (let iteracao = 0; iteracao < MAX_CHAMADAS_FERRAMENTA_POR_TURNO; iteracao++) {
      const resposta = await chamarModelo(mensagens, ferramentas);

      if (resposta.toolCalls.length === 0) {
        respostaFinal = resposta.texto ?? "";
        break;
      }

      mensagens.push({
        role: "assistant",
        content: resposta.texto,
        tool_calls: resposta.toolCalls,
      });

      for (const chamada of resposta.toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(chamada.function.arguments || "{}");
        } catch {
          args = {};
        }

        const resultado = await executarFerramenta(chamada.function.name, args, usuario);
        ferramentasChamadas.push({ nome: chamada.function.name, args, resultado });

        mensagens.push({
          role: "tool",
          tool_call_id: chamada.id,
          content: JSON.stringify(resultado),
        });
      }

      if (iteracao === MAX_CHAMADAS_FERRAMENTA_POR_TURNO - 1) {
        estourouLimite = true;
      }
    }
  } catch (erro) {
    erroFinal = erro instanceof Error ? erro.message : "Erro inesperado ao consultar o assistente.";
  }

  const ultimaChamada = ferramentasChamadas[ferramentasChamadas.length - 1];
  let aguardandoConfirmacao = false;
  let nivelConfirmacao: 1 | 2 | 3 | undefined;

  // Guarda os argumentos resolvidos da prévia na conversa — só assim o turno
  // seguinte (confirmar/cancelar) sabe exatamente o que executar, sem depender
  // do modelo repetir os mesmos argumentos corretamente.
  //
  // Procura a ÚLTIMA prévia bem-sucedida do turno, não a última ferramenta:
  // o modelo às vezes faz uma busca depois de montar a prévia, e olhar só a
  // última chamada descartava a prévia nova em silêncio — a antiga continuava
  // pendente, então um "confirma" registraria os valores velhos.
  const ultimaPrevia = [...ferramentasChamadas]
    .reverse()
    .find(
      (chamada) =>
        chamada.nome.endsWith("_preview") &&
        chamada.resultado.success &&
        typeof chamada.resultado.data === "object" &&
        chamada.resultado.data !== null &&
        "resolvido" in (chamada.resultado.data as Record<string, unknown>)
    );

  if (!erroFinal && ultimaPrevia && ultimaPrevia.resultado.success) {
    const resolvido = (ultimaPrevia.resultado.data as Record<string, unknown>).resolvido;
    await prisma.assistenteConversa.update({
      where: { id: conversaId },
      data: {
        previewFerramenta: ultimaPrevia.nome,
        previewArgs: paraJsonSeguro(resolvido) as Prisma.InputJsonValue,
        previewCriadoEm: new Date(),
      },
    });
    aguardandoConfirmacao = true;
    nivelConfirmacao = buscarFerramenta(ultimaPrevia.nome)?.nivel;

    // A prévia existe e está válida — o usuário PRECISA vê-la. Se o modelo
    // gastou as rodadas buscando produto e não sobrou turno para ele redigir a
    // resposta, mostramos o texto da própria ferramenta (que já traz itens,
    // total e avisos) em vez de um "não consegui" com uma venda pendente atrás.
    if (!respostaFinal.trim() || estourouLimite) {
      const avisos = ultimaPrevia.resultado.warnings ?? [];
      respostaFinal = [ultimaPrevia.resultado.message, ...avisos.map((a) => `⚠ ${a}`)].join("\n");
    }
  } else if (estourouLimite && !respostaFinal.trim()) {
    respostaFinal = "Não consegui concluir essa consulta — tente reformular de um jeito mais direto.";
  }

  // Prévia herdada de um turno anterior que continua pendente porque ESTE turno
  // não montou uma nova. Se o usuário pediu uma correção e o modelo respondeu só
  // com texto, os números da resposta não são os que estão guardados — e um
  // "confirma" registraria os valores antigos sem ninguém perceber. Como não dá
  // para distinguir isso de uma pergunta solta no meio do caminho, o aviso é
  // sempre dado: é barato e impede o registro errado silencioso.
  if (!erroFinal && !aguardandoConfirmacao && conversa.previewFerramenta && !respostaFinal.startsWith("Operação cancelada")) {
    respostaFinal +=
      "\n\n⚠ Atenção: ainda existe uma prévia aguardando confirmação, montada ANTES desta mensagem. " +
      "Se você confirmar agora, vale exatamente o que estava naquela prévia — não os valores desta resposta. " +
      "Se quiser mudar alguma coisa, peça a operação de novo por inteiro.";
  }

  await registrarInteracaoAssistente({
    usuarioId: usuario.id,
    conversaId,
    requestId,
    mensagemOriginal: textoLimpo,
    tipoEntrada: origemEntrada,
    transcricao: transcricao ?? null,
    ferramenta: ultimaChamada?.nome ?? null,
    argumentosJson: ultimaChamada ? (paraJsonSeguro(ultimaChamada.args) as Prisma.InputJsonValue) : undefined,
    resultadoJson: erroFinal
      ? undefined
      : (paraJsonSeguro({ resposta: respostaFinal, ferramentasChamadas }) as Prisma.InputJsonValue),
    erro: erroFinal,
  });

  if (!aguardandoConfirmacao) {
    await prisma.assistenteConversa.update({ where: { id: conversaId }, data: { updatedAt: new Date() } });
  }

  if (erroFinal) {
    return {
      resposta: mensagemDeFalha(erroFinal),
      estado: "erro",
    };
  }

  return {
    resposta: respostaFinal || "Não entendi — pode reformular?",
    estado: "concluido",
    aguardandoConfirmacao,
    nivelConfirmacao,
  };
}
