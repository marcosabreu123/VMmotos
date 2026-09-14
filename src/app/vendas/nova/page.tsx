import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CarrinhoVenda } from "@/components/CarrinhoVenda";
import { buscarVendaPorId } from "@/lib/vendas";
import { estoqueDeVariosProdutos } from "@/lib/produtos";
import { listarMecanicos } from "@/lib/oficina/mecanicos";
import { listarTiposServico } from "@/lib/oficina/tiposServico";
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
      const estoques = await estoqueDeVariosProdutos(itensAtivos.map((i) => i.produtoId));

      itensIniciais = itensAtivos.map((item) => ({
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
          estoqueAtual: estoques.get(item.produtoId) ?? 0,
        },
      }));
    }
  }

  const [mecanicos, tiposServico] = await Promise.all([listarMecanicos(), listarTiposServico()]);

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader title="Nova venda" />
      <CarrinhoVenda
        itensIniciais={itensIniciais}
        mecanicos={mecanicos.map((m) => ({ id: m.id, nome: m.nome, socioOficina: m.socioOficina }))}
        tiposServico={tiposServico.map((t) => ({ id: t.id, nome: t.nome, valorSugerido: t.valorSugerido }))}
      />
    </AppShell>
  );
}
