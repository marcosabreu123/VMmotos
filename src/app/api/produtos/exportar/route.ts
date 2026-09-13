import { NextResponse } from "next/server";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { listarProdutos } from "@/lib/produtos";
import { montarLinhaCsv } from "@/lib/csv";

const CABECALHO = [
  "nome",
  "marca",
  "categoria",
  "medida",
  "sku",
  "codigoBarras",
  "precoCustoRef",
  "precoVenda",
  "fornecedor",
  "atributoA",
  "atributoB",
  "tipoVenda",
  "estoqueMinimo",
  "ativo",
];

export async function GET() {
  await requireLeitura("produtos");

  const [produtosAtivos, produtosArquivados] = await Promise.all([
    listarProdutos(undefined, false),
    listarProdutos(undefined, true),
  ]);
  const produtos = [...produtosAtivos, ...produtosArquivados];

  const linhas = produtos.map((produto) =>
    montarLinhaCsv([
      produto.nome,
      produto.marca,
      produto.categoria,
      produto.medida?.toString() ?? "",
      produto.sku,
      produto.codigoBarras ?? "",
      (produto.precoCustoRef / 100).toFixed(2),
      (produto.precoVenda / 100).toFixed(2),
      produto.fornecedor?.nome ?? "",
      produto.atributoA ?? "",
      produto.atributoB ?? "",
      produto.tipoVenda,
      produto.estoqueMinimo.toString(),
      produto.ativo ? "sim" : "nao",
    ])
  );

  const csv = "﻿" + [montarLinhaCsv(CABECALHO), ...linhas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="produtos.csv"`,
    },
  });
}
