import { notFound } from "next/navigation";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { DespesaForm } from "@/components/DespesaForm";
import { BotaoAlternarAtivo } from "@/components/BotaoAlternarAtivo";
import { buscarDespesaPorId, statusEfetivoDespesa } from "@/lib/despesas";
import { listarCategoriasDespesa } from "@/lib/despesas";
import { listarFornecedores } from "@/lib/fornecedores";
import { atualizarDespesaAction, alterarAtivoDespesaAction } from "../actions";
import { DespesaAcoes } from "./DespesaAcoes";

const LABEL_STATUS_EFETIVO: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

export default async function DetalheDespesaPage({
  params,
}: {
  params: Promise<{ despesaId: string }>;
}) {
  const usuario = await requireLeitura("despesas");
  const { despesaId } = await params;

  const [despesa, categorias, fornecedores] = await Promise.all([
    buscarDespesaPorId(despesaId),
    listarCategoriasDespesa(),
    listarFornecedores(),
  ]);

  if (!despesa) notFound();

  const statusEfetivo = statusEfetivoDespesa(despesa);
  const acaoAtualizar = atualizarDespesaAction.bind(null, despesaId);
  const ehTemplateRecorrencia = despesa.despesaOrigemId === null && despesa.recorrencia !== "NENHUMA";

  return (
    <AppShell usuario={usuario}>
      <PageHeader
        title={despesa.descricao}
        action={
          <BotaoAlternarAtivo
            ativo={despesa.ativo}
            acao={alterarAtivoDespesaAction.bind(null, despesa.id, !despesa.ativo)}
          />
        }
      />

      {!despesa.ativo && <p className="badge badge-danger mb-3 w-fit">Despesa arquivada</p>}
      <p className="badge mb-6 w-fit">{LABEL_STATUS_EFETIVO[statusEfetivo]}</p>

      {despesa.motivoCancelamento && (
        <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
          Cancelada por {despesa.canceladoPor?.nome} em {despesa.canceladoEm?.toLocaleString("pt-BR")}: {despesa.motivoCancelamento}
        </p>
      )}
      {despesa.recorrencia !== "NENHUMA" && (
        <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
          {ehTemplateRecorrencia
            ? `Recorrência ${despesa.recorrencia.toLowerCase()} — status: ${despesa.statusRecorrencia?.toLowerCase()}`
            : "Gerada a partir de uma despesa recorrente."}
        </p>
      )}

      <div className="mb-6">
        <DespesaAcoes
          despesaId={despesa.id}
          status={despesa.status}
          ehTemplateRecorrencia={ehTemplateRecorrencia}
          statusRecorrencia={despesa.statusRecorrencia}
        />
      </div>

      <DespesaForm
        action={acaoAtualizar}
        categorias={categorias}
        fornecedores={fornecedores}
        ehEdicao
        valoresIniciais={{
          descricao: despesa.descricao,
          categoriaId: despesa.categoriaId,
          fornecedorId: despesa.fornecedorId,
          valor: despesa.valor,
          dataDespesa: despesa.dataDespesa,
          vencimento: despesa.vencimento,
          formaPagamento: despesa.formaPagamento,
          classificacao: despesa.classificacao,
          entraNoLucroLiquido: despesa.entraNoLucroLiquido,
          observacoes: despesa.observacoes,
          comprovantePath: despesa.comprovantePath,
        }}
      />
    </AppShell>
  );
}
