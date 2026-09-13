import { assistenteConfig } from "./config";

// Converte um "relógio de parede" (data+hora) num fuso horário específico para
// o instante UTC correspondente — truque padrão sem depender de lib externa
// (Intl.DateTimeFormat já resolve o offset certo, inclusive em bordas de DST,
// embora o Brasil não tenha mais horário de verão desde 2019).
function relogioParaUtc(dataISO: string, horaISO: string, timezone: string): Date {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const [hora, minuto, segundo] = horaISO.split(":").map(Number);

  const palpite = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto, segundo));

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const partes = Object.fromEntries(formatter.formatToParts(palpite).map((p) => [p.type, p.value]));
  const localComoSeFosseUtc = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second)
  );
  const diferencaMs = palpite.getTime() - localComoSeFosseUtc;
  return new Date(palpite.getTime() + diferencaMs);
}

function deslocarDataISO(dataISO: string, dias: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Data de hoje (YYYY-MM-DD) no timezone configurado do assistente. */
export function dataHojeISO(timezone: string = assistenteConfig.timezone): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/** Início/fim (instantes UTC) do dia informado, no timezone configurado. */
export function limitesDoDia(
  dataISO: string,
  timezone: string = assistenteConfig.timezone
): { inicio: Date; fim: Date } {
  const inicio = relogioParaUtc(dataISO, "00:00:00", timezone);
  const inicioDiaSeguinte = relogioParaUtc(deslocarDataISO(dataISO, 1), "00:00:00", timezone);
  return { inicio, fim: new Date(inicioDiaSeguinte.getTime() - 1) };
}

/**
 * Resolve expressões de data relativa comuns em pt-BR para uma data absoluta
 * (YYYY-MM-DD) no timezone configurado. Expressões mais elaboradas ("mês
 * passado", "sexta passada", "20 de julho") ficam a cargo do próprio modelo,
 * que recebe a data de hoje no system prompt e devolve a data já resolvida
 * como argumento da ferramenta — esta função cobre só os casos mais diretos
 * e serve de validação/fallback determinístico.
 */
export function resolverDataRelativa(expressao: string, timezone: string = assistenteConfig.timezone): string | null {
  const termo = expressao.trim().toLowerCase();
  const hoje = dataHojeISO(timezone);

  if (/^\d{4}-\d{2}-\d{2}$/.test(termo)) return termo;
  if (termo === "hoje" || termo === "agora") return hoje;
  if (termo === "ontem") return deslocarDataISO(hoje, -1);
  if (termo === "anteontem") return deslocarDataISO(hoje, -2);

  const diaDoMes = termo.match(/^dia (\d{1,2})$/);
  if (diaDoMes) {
    const [ano, mes] = hoje.split("-");
    return `${ano}-${mes}-${diaDoMes[1].padStart(2, "0")}`;
  }

  return null;
}
