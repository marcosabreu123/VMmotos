import { prisma } from "@/lib/db";
import { assistenteConfig } from "./config";

export type ConfigAdmin = {
  habilitado: boolean;
  limiteDiarioPorUsuario: number;
  valorAltoCentavos: number;
};

// Config administrável pelo Dono, guardada num singleton no banco — os
// valores de src/lib/assistente/config.ts (env vars) continuam servindo de
// fallback enquanto nenhuma linha existir, e para o que ainda não é
// administrável por aqui (modelo, timezone, limites de áudio).
export async function obterConfigAdmin(): Promise<ConfigAdmin> {
  const linha = await prisma.configuracaoAssistente.findFirst();
  return {
    habilitado: linha?.habilitado ?? assistenteConfig.enabled,
    limiteDiarioPorUsuario: linha?.limiteDiarioPorUsuario ?? assistenteConfig.dailyLimitPerUser,
    valorAltoCentavos: linha?.valorAltoCentavos ?? 50000,
  };
}

export async function atualizarConfigAdmin(dados: Partial<ConfigAdmin>) {
  const linha = await prisma.configuracaoAssistente.findFirst();
  if (linha) {
    return prisma.configuracaoAssistente.update({ where: { id: linha.id }, data: dados });
  }
  return prisma.configuracaoAssistente.create({ data: dados });
}

export type MetricasAssistente = {
  interacoesHoje: number;
  interacoesTotal: number;
  interacoesComErroHoje: number;
  porFerramenta: Array<{ ferramenta: string; quantidade: number }>;
};

export async function obterMetricasAssistente(): Promise<MetricasAssistente> {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const [interacoesHoje, interacoesTotal, interacoesComErroHoje, agrupadoPorFerramenta] = await Promise.all([
    prisma.assistenteInteracao.count({ where: { createdAt: { gte: inicioDoDia } } }),
    prisma.assistenteInteracao.count(),
    prisma.assistenteInteracao.count({ where: { createdAt: { gte: inicioDoDia }, erro: { not: null } } }),
    prisma.assistenteInteracao.groupBy({
      by: ["ferramenta"],
      where: { ferramenta: { not: null } },
      _count: true,
      orderBy: { _count: { ferramenta: "desc" } },
      take: 10,
    }),
  ]);

  return {
    interacoesHoje,
    interacoesTotal,
    interacoesComErroHoje,
    porFerramenta: agrupadoPorFerramenta.map((linha) => ({
      ferramenta: linha.ferramenta ?? "—",
      quantidade: linha._count,
    })),
  };
}
