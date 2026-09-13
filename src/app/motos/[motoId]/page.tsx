import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { historicoDaMoto, formatarPlaca } from "@/lib/motos";
import { podeLer } from "@/lib/permissoes";
import { centavosParaReais } from "@/lib/money";

/**
 * Histórico da moto — a pergunta que o dono faz no balcão: "essa moto já veio
 * aqui, o que foi feito nela?". Mostra peça trocada e mão de obra, do
 * atendimento mais recente para o mais antigo.
 */
export default async function MotoPage({
  params,
}: {
  params: Promise<{ motoId: string }>;
}) {
  const usuario = await requireLeitura("motos");
  const { motoId } = await params;
  const moto = await historicoDaMoto(motoId);

  if (!moto) notFound();

  // Quem não tem acesso à oficina não vê quanto cada mecânico levou — o que
  // foi feito na moto, sim.
  const vePessoalDaOficina = podeLer(usuario, "oficina");

  return (
    <AppShell usuario={usuario}>
      <PageHeader title={formatarPlaca(moto.placa)} />

      <section className="card mb-8 p-5">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="label-caps">Modelo</dt>
            <dd className="mt-1">{moto.modelo ?? "Não informado"}</dd>
          </div>
          <div>
            <dt className="label-caps">Cliente</dt>
            <dd className="mt-1">
              {moto.cliente ? (
                <Link href={`/clientes/${moto.cliente.id}`} style={{ color: "var(--accent)" }}>
                  {moto.cliente.nome}
                </Link>
              ) : (
                "Não vinculado"
              )}
            </dd>
          </div>
          <div>
            <dt className="label-caps">Atendimentos</dt>
            <dd className="mt-1">{moto.vendas.length}</dd>
          </div>
        </dl>
        {moto.observacoes && (
          <p className="ajuda mt-4">{moto.observacoes}</p>
        )}
      </section>

      <section>
        <h2 className="label-caps mb-3">O que já foi feito nesta moto</h2>

        {moto.vendas.length === 0 ? (
          <p className="state-empty">
            Esta moto ainda não passou por nenhum atendimento registrado.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {moto.vendas.map((venda) => (
              <li key={venda.id} className="card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/vendas/${venda.id}`}
                    className="font-medium"
                    style={{ color: "var(--accent)" }}
                  >
                    {venda.dataHora.toLocaleDateString("pt-BR")}
                  </Link>
                  <span className="font-semibold">{centavosParaReais(venda.total)}</span>
                </div>

                {venda.itens.length > 0 && (
                  <div className="mb-2">
                    <p className="label-caps mb-1">Peças</p>
                    <ul className="text-sm">
                      {venda.itens.map((item) => (
                        <li key={item.id}>
                          {item.quantidade}× {item.produto.nome}{" "}
                          <span style={{ color: "var(--muted)" }}>{item.produto.marca}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {venda.servicos.length > 0 && (
                  <div>
                    <p className="label-caps mb-1">Mão de obra</p>
                    <ul className="text-sm">
                      {venda.servicos.map((servico) => (
                        <li key={servico.id}>
                          {servico.descricao}{" "}
                          <span style={{ color: "var(--muted)" }}>
                            · {centavosParaReais(servico.valor)}
                          </span>
                          {vePessoalDaOficina && servico.repasses.length > 0 && (
                            <span style={{ color: "var(--muted)" }}>
                              {" "}
                              ({servico.repasses.map((r) => r.mecanico.nome).join(", ")})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {venda.itens.length === 0 && venda.servicos.length === 0 && (
                  <p className="ajuda">Atendimento sem itens registrados.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
