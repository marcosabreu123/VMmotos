import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { buscarLotePorId, statusValidadeLote, LABEL_TIPO_MOVIMENTACAO } from "@/lib/estoque";
import { formatQuantidadeEstoque, unidadeEstoque } from "@/lib/unidadeEstoque";
import { centavosParaReais } from "@/lib/money";
import { podeVerCustos } from "@/lib/permissoes";
import { LoteAcoes } from "./LoteAcoes";

const BADGE_VALIDADE: Record<string, string> = {
  vencido: "badge-danger",
  vence_em_breve: "badge-warning",
  ok: "badge-success",
  sem_validade: "badge",
};

const LABEL_VALIDADE: Record<string, string> = {
  vencido: "Vencido",
  vence_em_breve: "Vence em breve",
  ok: "Validade ok",
  sem_validade: "Sem validade",
};

export default async function LoteDetalhePage({
  params,
}: {
  params: Promise<{ loteId: string }>;
}) {
  const usuario = await requireUser();
  const { loteId } = await params;

  const lote = await buscarLotePorId(loteId);
  if (!lote) notFound();

  const validade = statusValidadeLote(lote.dataValidade);
  const unidade = unidadeEstoque(lote.produto.tipoVenda);
  const podeVerCusto = podeVerCustos(usuario.papel);

  return (
    <AppShell usuario={usuario}>
      <PageHeader title={`Lote ${lote.numero}`} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className={`badge ${lote.status === "BLOQUEADO" ? "badge-danger" : "badge-success"}`}>
          {lote.status === "BLOQUEADO" ? "Bloqueado" : "Ativo"}
        </span>
        <span className={`badge ${BADGE_VALIDADE[validade]}`}>
          {LABEL_VALIDADE[validade]}
          {lote.dataValidade && ` · ${lote.dataValidade.toLocaleDateString("pt-BR")}`}
        </span>
      </div>

      <section className="card mb-6 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <div>
          <p className="label-caps mb-1">Produto</p>
          <p>{lote.produto.nome}</p>
        </div>
        {podeVerCusto && (
          <div>
            <p className="label-caps mb-1">Custo real</p>
            <p>
              {centavosParaReais(lote.custoReal)}/{unidade}
              {lote.freteRateado > 0 && ` (frete rateado ${centavosParaReais(lote.freteRateado)})`}
            </p>
          </div>
        )}
        <div>
          <p className="label-caps mb-1">Estoque venda</p>
          <p>{formatQuantidadeEstoque(lote.quantidadeAtualVenda, lote.produto.tipoVenda)}</p>
        </div>
        <div>
          <p className="label-caps mb-1">Estoque demonstracao</p>
          <p>{formatQuantidadeEstoque(lote.quantidadeAtualDemonstracao, lote.produto.tipoVenda)}</p>
        </div>
      </section>

      <section className="mb-6 no-print">
        <h2 className="label-caps mb-3">Ações</h2>
        <LoteAcoes loteId={lote.id} status={lote.status} unidade={unidade} />
      </section>

      <section>
        <h2 className="label-caps mb-3">Movimentações deste lote</h2>
        {lote.movimentacoes.length === 0 ? (
          <p className="state-empty">Nenhuma movimentação registrada ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lote.movimentacoes.map((mov) => (
              <li key={mov.id} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{LABEL_TIPO_MOVIMENTACAO[mov.tipo]}</p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {mov.createdAt.toLocaleString("pt-BR")} · {mov.usuario.nome}
                    {mov.observacao && ` · ${mov.observacao}`}
                  </p>
                </div>
                <span className="font-semibold">{formatQuantidadeEstoque(mov.quantidade, lote.produto.tipoVenda)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
