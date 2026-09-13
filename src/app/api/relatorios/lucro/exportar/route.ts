import { NextResponse, type NextRequest } from "next/server";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { podeVerCustos } from "@/lib/permissoes";
import { detalhamentoLucro, resolverPeriodo, type ChavePeriodo, type AgrupamentoLucro } from "@/lib/lucro";
import { montarLinhaCsv } from "@/lib/csv";

const CABECALHO = ["item", "faturamento", "custo", "lucroBruto", "margem", "quantidade"];

export async function GET(request: NextRequest) {
  const usuario = await requireLeitura("relatorios");
  if (!podeVerCustos(usuario.papel)) {
    return NextResponse.json({ erro: "Sem permissão para exportar este relatório." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const periodo = resolverPeriodo(
    (params.get("periodo") as ChavePeriodo) ?? "mesAtual",
    params.get("dataInicio") && params.get("dataFim")
      ? { inicio: new Date(params.get("dataInicio")!), fim: new Date(params.get("dataFim")!) }
      : undefined
  );
  const agrupamento = (params.get("agrupamento") as AgrupamentoLucro) ?? "produto";

  const linhas = await detalhamentoLucro(periodo, agrupamento);

  const csvLinhas = linhas.map((linha) =>
    montarLinhaCsv([
      linha.label,
      (linha.faturamento / 100).toFixed(2),
      (linha.custo / 100).toFixed(2),
      (linha.lucroBruto / 100).toFixed(2),
      linha.margem.toFixed(1),
      String(linha.quantidade),
    ])
  );

  const csv = "﻿" + [montarLinhaCsv(CABECALHO), ...csvLinhas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-lucro.csv"`,
    },
  });
}
