import { NextResponse, type NextRequest } from "next/server";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { listarDespesas, statusEfetivoDespesa, type FiltrosDespesas } from "@/lib/despesas";
import { montarLinhaCsv } from "@/lib/csv";

const CABECALHO = ["descricao", "categoria", "fornecedor", "valor", "dataDespesa", "vencimento", "dataPagamento", "status", "formaPagamento", "classificacao", "recorrencia"];

export async function GET(request: NextRequest) {
  await requireLeitura("despesas");

  const params = request.nextUrl.searchParams;
  const filtros: FiltrosDespesas = {
    dataInicio: params.get("dataInicio") ? new Date(params.get("dataInicio")!) : undefined,
    dataFim: params.get("dataFim") ? new Date(`${params.get("dataFim")}T23:59:59`) : undefined,
    categoriaId: params.get("categoriaId") || undefined,
    status: (params.get("status") as FiltrosDespesas["status"]) || undefined,
    formaPagamento: (params.get("formaPagamento") as FiltrosDespesas["formaPagamento"]) || undefined,
    recorrencia: (params.get("recorrencia") as FiltrosDespesas["recorrencia"]) || undefined,
    usuarioId: params.get("usuarioId") || undefined,
    pagina: 1,
    porPagina: 10000,
  };

  const { despesas } = await listarDespesas(filtros);

  const linhas = despesas.map((despesa) =>
    montarLinhaCsv([
      despesa.descricao,
      despesa.categoria.nome,
      despesa.fornecedor?.nome ?? "",
      (despesa.valor / 100).toFixed(2),
      despesa.dataDespesa.toISOString().slice(0, 10),
      despesa.vencimento ? despesa.vencimento.toISOString().slice(0, 10) : "",
      despesa.dataPagamento ? despesa.dataPagamento.toISOString().slice(0, 10) : "",
      statusEfetivoDespesa(despesa),
      despesa.formaPagamento ?? "",
      despesa.classificacao,
      despesa.recorrencia,
    ])
  );

  const csv = "﻿" + [montarLinhaCsv(CABECALHO), ...linhas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="despesas.csv"`,
    },
  });
}
