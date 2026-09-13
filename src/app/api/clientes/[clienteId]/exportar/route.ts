import { NextResponse } from "next/server";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { buscarClientePorId } from "@/lib/clientes";
import { montarLinhaCsv } from "@/lib/csv";

const CABECALHO = ["data", "status", "produto", "quantidade", "totalVenda"];

export async function GET(_request: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  await requireLeitura("clientes");
  const { clienteId } = await params;

  const cliente = await buscarClientePorId(clienteId);
  if (!cliente) {
    return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
  }

  const linhas: string[] = [];
  for (const venda of cliente.vendas) {
    for (const item of venda.itens) {
      linhas.push(
        montarLinhaCsv([
          venda.dataHora.toISOString(),
          venda.status,
          item.produto.nome,
          String(item.quantidade),
          (venda.total / 100).toFixed(2),
        ])
      );
    }
  }

  const csv = "﻿" + [montarLinhaCsv(CABECALHO), ...linhas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="historico-${cliente.nome.replace(/\s+/g, "-").toLowerCase()}.csv"`,
    },
  });
}
