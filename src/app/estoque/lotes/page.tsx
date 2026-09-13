import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarLotesGerenciaveis, statusValidadeLote, type StatusValidade } from "@/lib/estoque";
import { formatQuantidadeEstoque } from "@/lib/unidadeEstoque";

const ORDEM_SEVERIDADE: Record<StatusValidade, number> = {
  vencido: 0,
  vence_em_breve: 1,
  sem_validade: 2,
  ok: 3,
};

const BADGE_VALIDADE: Record<StatusValidade, string> = {
  vencido: "badge-danger",
  vence_em_breve: "badge-warning",
  ok: "badge-success",
  sem_validade: "badge",
};

const LABEL_VALIDADE: Record<StatusValidade, string> = {
  vencido: "Vencido",
  vence_em_breve: "Vence em breve",
  ok: "Validade ok",
  sem_validade: "Sem validade",
};

export default async function LotesPage() {
  const usuario = await requireUser();
  const lotes = await listarLotesGerenciaveis();

  const lotesOrdenados = [...lotes].sort((a, b) => {
    const severidadeA = ORDEM_SEVERIDADE[statusValidadeLote(a.dataValidade)];
    const severidadeB = ORDEM_SEVERIDADE[statusValidadeLote(b.dataValidade)];
    return severidadeA - severidadeB;
  });

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader title="Lotes e validade" />

      {lotesOrdenados.length === 0 ? (
        <p className="state-empty">Nenhum lote registrado ainda.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {lotesOrdenados.map((lote) => {
            const validade = statusValidadeLote(lote.dataValidade);
            return (
              <Link
                key={lote.id}
                href={`/estoque/lotes/${lote.id}`}
                className="card card-interactive flex flex-wrap items-center gap-3 p-4"
              >
                <span className="flex-1 font-medium">{lote.produto.nome}</span>
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  Lote {lote.numero}
                </span>
                <span className={`badge ${lote.status === "BLOQUEADO" ? "badge-danger" : "badge-success"}`}>
                  {lote.status === "BLOQUEADO" ? "Bloqueado" : "Ativo"}
                </span>
                <span className={`badge ${BADGE_VALIDADE[validade]}`}>
                  {LABEL_VALIDADE[validade]}
                  {lote.dataValidade && ` · ${lote.dataValidade.toLocaleDateString("pt-BR")}`}
                </span>
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  {formatQuantidadeEstoque(lote.quantidadeAtualVenda, lote.produto.tipoVenda)}
                </span>
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  Demonstracao: {formatQuantidadeEstoque(lote.quantidadeAtualDemonstracao, lote.produto.tipoVenda)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
