import { unidadeEstoque, type TipoVendaLiteral } from "@/lib/unidadeEstoque";

export function EstoqueBadge({
  estoqueAtual,
  estoqueMinimo,
  tipoVenda = "UNIDADE",
}: {
  estoqueAtual: number;
  estoqueMinimo: number;
  tipoVenda?: TipoVendaLiteral;
}) {
  const abaixoDoMinimo = estoqueAtual <= estoqueMinimo;

  return (
    <span className={`badge ${abaixoDoMinimo ? "badge-danger" : "badge-success"}`}>
      {estoqueAtual} {unidadeEstoque(tipoVenda)} em estoque{abaixoDoMinimo ? " · repor" : ""}
    </span>
  );
}
