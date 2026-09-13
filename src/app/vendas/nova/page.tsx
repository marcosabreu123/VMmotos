import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CarrinhoVenda } from "@/components/CarrinhoVenda";
import { buscarVendaPorId } from "@/lib/vendas";
import { estoqueTotalProduto } from "@/lib/produtos";
import type { ItemCarrinhoCliente } from "@/components/CarrinhoVenda";

export default async function NovaVendaPage({
  searchParams,
}: {
  searchParams: Promise<{ duplicar?: string }>;
}) {
  const usuario = await requireLeitura("vendas");
  const { duplicar } = await searchParams;

  let itensIniciais: ItemCarrinhoCliente[] | undefined;

  if (duplicar) {
    const venda = await buscarVendaPorId(duplicar);
    if (venda) {
      const itensAtivos = venda.itens.filter((item) => item.produto.ativo);
      const estoques = await Promise.all(itensAtivos.map((item) => estoqueTotalProduto(item.produtoId)));

      itensIniciais = itensAtivos.map((item, indice) => ({
        quantidade: item.quantidade,
        produto: {
          id: item.produto.id,
          nome: item.produto.nome,
          marca: item.produto.marca,
          sku: item.produto.sku,
          codigoBarras: item.produto.codigoBarras,
          medida: item.produto.medida,
          precoVenda: item.produto.precoVenda,
          tipoVenda: item.produto.tipoVenda,
          atributoB: item.produto.atributoB,
          fotoPath: item.produto.fotoPath,
          estoqueAtual: estoques[indice],
        },
      }));
    }
  }

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader title="Nova venda" />
      <CarrinhoVenda itensIniciais={itensIniciais} />
    </AppShell>
  );
}
