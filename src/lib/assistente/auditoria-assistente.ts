import { prisma } from "@/lib/db";
import type { Prisma, TipoEntradaAssistente } from "@prisma/client";

export type DadosInteracaoAssistente = {
  usuarioId: string;
  conversaId: string;
  requestId: string;
  mensagemOriginal: string;
  tipoEntrada: TipoEntradaAssistente;
  transcricao?: string | null;
  intentJson?: Prisma.InputJsonValue;
  ferramenta?: string | null;
  argumentosJson?: Prisma.InputJsonValue;
  resultadoJson?: Prisma.InputJsonValue;
  erro?: string | null;
};

// Log próprio do assistente (não é o mesmo que RegistroAuditoria) — guarda o
// contexto completo da interação de IA: mensagem original, ferramenta
// chamada, argumentos e resultado. A partir da Fase 2, toda ferramenta de
// escrita passa a também chamar registrarAuditoria(...) normalmente.
export async function registrarInteracaoAssistente(dados: DadosInteracaoAssistente) {
  return prisma.assistenteInteracao.create({
    data: {
      usuarioId: dados.usuarioId,
      conversaId: dados.conversaId,
      requestId: dados.requestId,
      mensagemOriginal: dados.mensagemOriginal,
      tipoEntrada: dados.tipoEntrada,
      transcricao: dados.transcricao ?? null,
      intentJson: dados.intentJson,
      ferramenta: dados.ferramenta ?? null,
      argumentosJson: dados.argumentosJson,
      resultadoJson: dados.resultadoJson,
      erro: dados.erro ?? null,
    },
  });
}
