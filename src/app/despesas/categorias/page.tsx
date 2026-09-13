import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { BotaoAlternarAtivo } from "@/components/BotaoAlternarAtivo";
import { listarCategoriasDespesa } from "@/lib/despesas";
import { alterarAtivoCategoriaDespesaAction } from "../actions";
import { CategoriaForm } from "./CategoriaForm";

export default async function CategoriasDespesaPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const usuario = await requireLeitura("despesas");
  const { filtro } = await searchParams;
  const apenasArquivadas = filtro === "arquivadas";
  const categorias = await listarCategoriasDespesa(apenasArquivadas);

  return (
    <AppShell usuario={usuario}>
      <PageHeader title={apenasArquivadas ? "Categorias arquivadas" : "Categorias de despesa"} />

      {apenasArquivadas ? (
        <Link href="/despesas/categorias" className="label-caps mb-4 inline-block" style={{ color: "var(--accent)" }}>
          ← ver categorias ativas
        </Link>
      ) : (
        <>
          <div className="mb-6">
            <CategoriaForm />
          </div>
          <Link
            href="/despesas/categorias?filtro=arquivadas"
            className="label-caps mb-4 inline-block"
            style={{ color: "var(--muted)" }}
          >
            Ver arquivadas
          </Link>
        </>
      )}

      <ul className="flex flex-col gap-2">
        {categorias.map((categoria) => (
          <li key={categoria.id} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{categoria.nome}</p>
              {categoria.padrao && (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Categoria padrão
                </p>
              )}
            </div>
            <BotaoAlternarAtivo
              ativo={categoria.ativo}
              acao={alterarAtivoCategoriaDespesaAction.bind(null, categoria.id, !categoria.ativo)}
            />
          </li>
        ))}
      </ul>

      <Link href="/despesas" className="label-caps mt-6 inline-block" style={{ color: "var(--accent)" }}>
        ← voltar para despesas
      </Link>
    </AppShell>
  );
}
