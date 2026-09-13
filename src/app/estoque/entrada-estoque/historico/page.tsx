import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { podeEscrever } from "@/lib/permissoes";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarEntradasEstoque } from "@/lib/entradaEstoque";
import { centavosParaReais } from "@/lib/money";

export default async function HistoricoEntradaEstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const usuario = await requireLeitura("estoque");
  const podeEditar = podeEscrever(usuario, "estoque");
  const params = await searchParams;
  const pagina = params.pagina ? Number(params.pagina) : 1;

  const { entradas, total, totalPaginas } = await listarEntradasEstoque({ pagina, porPagina: 20 });

  function paginaHref(numero: number) {
    return `/estoque/entrada-estoque/historico?pagina=${numero}`;
  }

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader
        title="Histórico de entradas"
        action={
          <Link href="/estoque/entrada-estoque" className="btn btn-primary">
            + Nova entrada
          </Link>
        }
      />

      <p className="label-caps mb-3">{total} entrada(s) registrada(s)</p>

      {entradas.length === 0 ? (
        <p className="state-empty">Nenhuma entrada de estoque registrada ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entradas.map((entrada) => {
            const subtotal = entrada.itens.reduce((soma, item) => soma + item.quantidade * item.custoUnitario, 0);
            const totalEntrada = subtotal + entrada.valorFrete;
            const quantidadeTotal = entrada.itens.reduce((soma, item) => soma + item.quantidade, 0);

            return (
              <div key={entrada.id} className="card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{entrada.fornecedor?.nome ?? "Sem fornecedor"}</p>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {entrada.dataEntrada.toLocaleDateString("pt-BR")} · {entrada.usuario.nome}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">{centavosParaReais(totalEntrada)}</p>
                      <p className="text-sm" style={{ color: "var(--muted)" }}>
                        {quantidadeTotal} un. {entrada.valorFrete > 0 ? `· frete ${centavosParaReais(entrada.valorFrete)}` : ""}
                      </p>
                    </div>
                    {podeEditar && (
                      <Link href={`/estoque/entrada-estoque/historico/${entrada.id}/editar`} className="btn btn-outline">
                        Editar
                      </Link>
                    )}
                  </div>
                </div>

                <ul className="flex flex-col gap-1 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  {entrada.itens.map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-sm">
                      <span>{item.produto.nome}</span>
                      <span style={{ color: "var(--muted)" }}>
                        {item.quantidade} un. × {centavosParaReais(item.custoUnitario)}
                      </span>
                    </li>
                  ))}
                </ul>

                {entrada.observacoes && (
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {entrada.observacoes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: totalPaginas }, (_, indice) => indice + 1).map((numero) => (
            <Link key={numero} href={paginaHref(numero)} className={`chip ${numero === pagina ? "chip-selected" : ""}`}>
              {numero}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
