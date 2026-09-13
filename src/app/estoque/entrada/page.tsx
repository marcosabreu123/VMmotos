import { redirect } from "next/navigation";

export default async function EntradaEstoqueRedirect({
  searchParams,
}: {
  searchParams: Promise<{ produtoId?: string }>;
}) {
  const { produtoId } = await searchParams;
  redirect(produtoId ? `/estoque/entrada-estoque?produtoId=${produtoId}` : "/estoque/entrada-estoque");
}
