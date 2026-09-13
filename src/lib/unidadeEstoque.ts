export type TipoVendaLiteral = "UNIDADE" | "FRACIONADO";

export function unidadeEstoque(tipoVenda: TipoVendaLiteral): "ml" | "un." {
  return tipoVenda === "FRACIONADO" ? "ml" : "un.";
}

export function formatQuantidadeEstoque(quantidade: number, tipoVenda: TipoVendaLiteral): string {
  return `${quantidade} ${unidadeEstoque(tipoVenda)}`;
}
