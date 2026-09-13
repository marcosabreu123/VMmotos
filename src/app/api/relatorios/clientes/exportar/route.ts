import { NextResponse, type NextRequest } from "next/server";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { rankingClientes, type FiltrosRanking } from "@/lib/clientes-relatorio";
import { resolverPeriodo, type ChavePeriodo } from "@/lib/lucro";
import { montarLinhaCsv } from "@/lib/csv";

const CABECALHO = ["nome", "telefone", "totalGasto", "numeroCompras", "ticketMedio", "ultimaCompra", "produtoFavorito", "categoriaPreferida", "marcaPreferida"];

export async function GET(request: NextRequest) {
  await requireLeitura("relatorios");

  const params = request.nextUrl.searchParams;
  const periodo = resolverPeriodo(
    (params.get("periodo") as ChavePeriodo) ?? "mesAtual",
    params.get("dataInicio") && params.get("dataFim")
      ? { inicio: new Date(params.get("dataInicio")!), fim: new Date(params.get("dataFim")!) }
      : undefined
  );

  const filtros: FiltrosRanking = {
    dataInicio: periodo.inicio,
    dataFim: periodo.fim,
    categoria: params.get("categoria") || undefined,
    marca: params.get("marca") || undefined,
    pagina: 1,
    porPagina: 10000,
  };

  const { linhas } = await rankingClientes(filtros);

  const csvLinhas = linhas.map((linha) =>
    montarLinhaCsv([
      linha.nome,
      linha.telefone ?? "",
      (linha.totalGastoCentavos / 100).toFixed(2),
      String(linha.numeroCompras),
      (linha.ticketMedioCentavos / 100).toFixed(2),
      linha.ultimaCompra.toISOString().slice(0, 10),
      linha.produtoMaisComprado ?? "",
      linha.categoriaPreferida ?? "",
      linha.marcaPreferida ?? "",
    ])
  );

  const csv = "﻿" + [montarLinhaCsv(CABECALHO), ...csvLinhas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ranking-clientes.csv"`,
    },
  });
}
