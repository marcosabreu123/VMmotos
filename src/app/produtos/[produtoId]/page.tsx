import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ProdutoForm } from "@/components/ProdutoForm";
import { listarFornecedores } from "@/lib/fornecedores";
import { buscarProdutoPorId } from "@/lib/produtos";
import { listarMovimentacoesPorProduto, LABEL_TIPO_MOVIMENTACAO } from "@/lib/estoque";
import { formatQuantidadeEstoque } from "@/lib/unidadeEstoque";
import { centavosParaReais } from "@/lib/money";
import { podeVerCustos } from "@/lib/permissoes";
import { BotaoAlternarAtivo } from "@/components/BotaoAlternarAtivo";
import { atualizarProdutoAction, alterarAtivoProdutoAction } from "../actions";
import type { TipoMovimentacao } from "@prisma/client";
import { nicho } from "@/config/nicho";

const TIPOS_ENTRADA: TipoMovimentacao[] = ["ENTRADA_ESTOQUE", "ENTRADA_COMPRA", "ENTRADA_MANUAL"];
const TIPOS_VENDA: TipoMovimentacao[] = ["SAIDA_VENDA", "DEVOLUCAO", "ESTORNO_CANCELAMENTO"];
const TIPOS_AJUSTE: TipoMovimentacao[] = [
  "AJUSTE_POSITIVO",
  "AJUSTE_NEGATIVO",
  "PERDA_VENCIMENTO",
  "PERDA_DEFEITO",
  "BRINDE",
];
const TIPOS_DEMONSTRACAO: TipoMovimentacao[] = ["SAIDA_DEMONSTRACAO", "TRANSFERENCIA_DEMONSTRACAO"];

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ produtoId: string }>;
}) {
  const usuario = await requireUser();
  const { produtoId } = await params;

  const [produto, fornecedores] = await Promise.all([
    buscarProdutoPorId(produtoId),
    listarFornecedores(),
  ]);

  if (!produto) notFound();

  const acaoAtualizar = atualizarProdutoAction.bind(null, produtoId);
  const podeVerCusto = podeVerCustos(usuario.papel);

  const lotesAtivos = produto.lotes.filter((lote) => lote.status === "ATIVO");
  const quantidadeAtual = lotesAtivos.reduce((soma, lote) => soma + lote.quantidadeAtualVenda, 0);
  const quantidadeDemonstracao = lotesAtivos.reduce((soma, lote) => soma + lote.quantidadeAtualDemonstracao, 0);
  const somaCusto = lotesAtivos.reduce((soma, lote) => soma + lote.custoReal * lote.quantidadeAtualVenda, 0);
  const custoMedio = quantidadeAtual > 0 ? Math.round(somaCusto / quantidadeAtual) : 0;
  const margem = produto.precoVenda - custoMedio;

  const movimentacoes = await listarMovimentacoesPorProduto(produto.id);
  const movimentacoesEntrada = movimentacoes.filter((mov) => TIPOS_ENTRADA.includes(mov.tipo));
  const movimentacoesVenda = movimentacoes.filter((mov) => TIPOS_VENDA.includes(mov.tipo));
  const movimentacoesAjuste = movimentacoes.filter((mov) => TIPOS_AJUSTE.includes(mov.tipo));
  const movimentacoesDemonstracao = movimentacoes.filter((mov) => TIPOS_DEMONSTRACAO.includes(mov.tipo));

  return (
    <AppShell usuario={usuario}>
        <PageHeader
          title={produto.nome}
          action={
            <div className="flex flex-wrap gap-2">
              <Link href={`/estoque/entrada-estoque?produtoId=${produto.id}`} className="btn btn-outline">
                Dar entrada de estoque
              </Link>
              <Link href={`/produtos/${produto.id}/etiqueta`} className="btn btn-outline">
                Imprimir etiqueta
              </Link>
              <BotaoAlternarAtivo
                ativo={produto.ativo}
                acao={alterarAtivoProdutoAction.bind(null, produto.id, !produto.ativo)}
              />
            </div>
          }
        />

        {!produto.ativo && (
          <p className="badge badge-danger mb-6 w-fit">Produto arquivado</p>
        )}

        <ProdutoForm
          action={acaoAtualizar}
          fornecedores={fornecedores}
          tipoVendaBloqueado={produto.lotes.length > 0}
          podeVerCustos={podeVerCusto}
          valoresIniciais={{
            nome: produto.nome,
            marca: produto.marca,
            categoria: produto.categoria,
            medida: produto.medida,
            sku: produto.sku,
            codigoBarras: produto.codigoBarras,
            precoCustoRef: produto.precoCustoRef,
            precoVenda: produto.precoVenda,
            fornecedorId: produto.fornecedorId,
            atributoA: produto.atributoA,
            atributoB: produto.atributoB,
            tipoVenda: produto.tipoVenda,
            estoqueMinimo: produto.estoqueMinimo,
            fotoPath: produto.fotoPath,
          }}
        />

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Indicadores</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <p className="label-caps mb-1">Quantidade atual</p>
              <p className="text-xl font-bold">{formatQuantidadeEstoque(quantidadeAtual, produto.tipoVenda)}</p>
            </div>
            <div className="card p-4">
              <p className="label-caps mb-1">Demonstracao</p>
              <p className="text-xl font-bold">{formatQuantidadeEstoque(quantidadeDemonstracao, produto.tipoVenda)}</p>
            </div>
            {podeVerCusto && (
              <div className="card p-4">
                <p className="label-caps mb-1">Margem</p>
                <p className="text-xl font-bold">{centavosParaReais(margem)}</p>
              </div>
            )}
            <div className="card p-4">
              <p className="label-caps mb-1">{nicho.termos.fornecedor.singular}</p>
              <p className="text-xl font-bold">{produto.fornecedor?.nome ?? "—"}</p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Histórico de entradas</h2>
          {movimentacoesEntrada.length === 0 ? (
            <p className="state-empty">Nenhuma entrada registrada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {movimentacoesEntrada.map((mov) => (
                <li key={mov.id} className="card flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{LABEL_TIPO_MOVIMENTACAO[mov.tipo]}</p>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {mov.createdAt.toLocaleString("pt-BR")} · {mov.usuario.nome}
                    </p>
                  </div>
                  <span className="font-semibold">{formatQuantidadeEstoque(mov.quantidade, produto.tipoVenda)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Histórico de vendas</h2>
          {movimentacoesVenda.length === 0 ? (
            <p className="state-empty">Nenhuma venda registrada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {movimentacoesVenda.map((mov) => (
                <li key={mov.id} className="card flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{LABEL_TIPO_MOVIMENTACAO[mov.tipo]}</p>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {mov.createdAt.toLocaleString("pt-BR")} · {mov.usuario.nome}
                    </p>
                  </div>
                  <span className="font-semibold">{formatQuantidadeEstoque(mov.quantidade, produto.tipoVenda)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Ajustes</h2>
          {movimentacoesAjuste.length === 0 ? (
            <p className="state-empty">Nenhum ajuste registrado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {movimentacoesAjuste.map((mov) => (
                <li key={mov.id} className="card flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{LABEL_TIPO_MOVIMENTACAO[mov.tipo]}</p>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {mov.createdAt.toLocaleString("pt-BR")} · {mov.usuario.nome}
                      {mov.observacao && ` · ${mov.observacao}`}
                    </p>
                  </div>
                  <span className="font-semibold">{formatQuantidadeEstoque(mov.quantidade, produto.tipoVenda)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Demonstracao</h2>
          {movimentacoesDemonstracao.length === 0 ? (
            <p className="state-empty">Nenhuma movimentação de demonstracao registrada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {movimentacoesDemonstracao.map((mov) => (
                <li key={mov.id} className="card flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{LABEL_TIPO_MOVIMENTACAO[mov.tipo]}</p>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {mov.createdAt.toLocaleString("pt-BR")} · {mov.usuario.nome}
                      {mov.observacao && ` · ${mov.observacao}`}
                    </p>
                  </div>
                  <span className="font-semibold">{formatQuantidadeEstoque(mov.quantidade, produto.tipoVenda)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
    </AppShell>
  );
}
