export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function reaisParaCentavos(valor: string | number): number {
  const numero = typeof valor === "string" ? Number(valor.replace(",", ".")) : valor;
  if (Number.isNaN(numero)) return 0;
  return Math.round(numero * 100);
}
