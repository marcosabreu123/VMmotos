import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { podeVerCustos } from "@/lib/permissoes";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { InsumoForm } from "@/components/InsumoForm";
import { BotaoAlternarAtivo } from "@/components/BotaoAlternarAtivo";
import { listarInsumos } from "@/lib/insumos";
import { centavosParaReais } from "@/lib/money";
import { criarInsumoAction, alterarAtivoInsumoAction } from "./actions";

export default async function InsumosPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const usuario = await requireLeitura("estoque");
  const { filtro } = await searchParams;
  const apenasArquivados = filtro === "arquivados";
  const insumos = await listarInsumos(apenasArquivados);
  const podeVerCusto = podeVerCustos(usuario.papel);

  return (
    <AppShell usuario={usuario}>
      <PageHeader title={apenasArquivados ? "Insumos arquivados" : "Insumos operacionais"} />

      {apenasArquivados ? (
        <Link href="/estoque/insumos" className="label-caps mb-4 inline-block" style={{ color: "var(--accent)" }}>
          ← ver insumos ativos
        </Link>
      ) : (
        <>
          <div className="mb-6">
            <InsumoForm action={criarInsumoAction} />
          </div>
          <Link href="/estoque/insumos?filtro=arquivados" className="label-caps mb-4 inline-block" style={{ color: "var(--muted)" }}>
            Ver arquivados
          </Link>
        </>
      )}

      <ul className="flex flex-col gap-2">
        {insumos.map((insumo) => (
          <li key={insumo.id} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{insumo.nome}</p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {insumo.unidade}
                {podeVerCusto && ` · ${centavosParaReais(insumo.custoUnitario)}/un.`}
                {insumo.estoqueAtual !== null && ` · ${insumo.estoqueAtual} em estoque`}
              </p>
            </div>
            <BotaoAlternarAtivo ativo={insumo.ativo} acao={alterarAtivoInsumoAction.bind(null, insumo.id, !insumo.ativo)} />
          </li>
        ))}
      </ul>

      <Link href="/estoque" className="label-caps mt-6 inline-block" style={{ color: "var(--accent)" }}>
        ← voltar para estoque
      </Link>
    </AppShell>
  );
}
