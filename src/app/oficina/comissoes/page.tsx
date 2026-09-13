import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { resumoParaFechar, detalheAPagar, historicoFechamentos } from "@/lib/oficina/fechamento";
import { formatarPlaca } from "@/lib/motos";
import { ehAdministrador } from "@/lib/permissoes";
import { centavosParaReais } from "@/lib/money";
import { BotaoFechar } from "./BotaoFechar";

/**
 * Comissões — o que cada um tem a receber, o extrato de onde veio, e o
 * pagamento (o "fechamento da semana").
 *
 * Os dois números ficam sempre separados, nunca somados: "a pagar" é dívida
 * real de hoje, "aguardando cliente" ainda não é. Somar faria o dono achar
 * que deve mais do que deve.
 */
export default async function ComissoesPage() {
  const usuario = await requireLeitura("oficina");
  const podeFechar = ehAdministrador(usuario.papel);

  const resumos = await resumoParaFechar();

  // O extrato só é buscado para quem tem algo a receber — não adianta abrir
  // consulta para mecânico zerado.
  const detalhes = await Promise.all(
    resumos.map(async (r) =>
      r.aPagarCentavos > 0 ? { id: r.mecanico.id, itens: await detalheAPagar(r.mecanico.id) } : null
    )
  );
  const detalhePorMecanico = new Map(
    detalhes.filter((d) => d !== null).map((d) => [d.id, d.itens])
  );

  const historico = await historicoFechamentos();

  const totalAPagar = resumos.reduce((s, r) => s + r.aPagarCentavos, 0);
  const totalPendente = resumos.reduce((s, r) => s + r.pendenteCentavos, 0);

  return (
    <AppShell usuario={usuario} wide>
      <PageHeader
        title="Comissões"
        action={
          <Link href="/oficina/mecanicos" className="btn btn-outline">
            Serviços e mão de obra
          </Link>
        }
      />

      <section className="resumo-grid">
        <div className="resumo-card">
          <p className="resumo-rotulo">Total a pagar agora</p>
          <p className={`resumo-valor${totalAPagar > 0 ? " resumo-valor-alerta" : ""}`}>
            {centavosParaReais(totalAPagar)}
          </p>
        </div>
        <div className="resumo-card">
          <p className="resumo-rotulo">Aguardando o cliente pagar</p>
          <p className="resumo-valor">{centavosParaReais(totalPendente)}</p>
        </div>
      </section>

      <p className="ajuda mb-6">
        <strong>A pagar</strong> é serviço que o cliente já quitou — é dívida sua
        com o mecânico hoje. <strong>Aguardando o cliente</strong> é serviço
        feito que ainda não foi pago; vira &quot;a pagar&quot; sozinho quando o
        cliente acertar.
      </p>

      <section className="mb-10">
        <h2 className="label-caps mb-3">Por mecânico</h2>

        {resumos.length === 0 ? (
          <p className="state-empty">Nenhum mecânico cadastrado.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {resumos.map((r) => {
              const itens = detalhePorMecanico.get(r.mecanico.id) ?? [];
              return (
                <li key={r.mecanico.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {r.mecanico.nome}
                        {r.mecanico.socioOficina && <span className="badge badge-accent ml-2">Sócio</span>}
                      </p>
                      <p className="ajuda">
                        {r.quantidadeServicos === 0
                          ? "Nenhum serviço fechado a pagar"
                          : `${r.quantidadeServicos} serviço(s) a pagar`}
                        {r.pendenteCentavos > 0 &&
                          ` · ${centavosParaReais(r.pendenteCentavos)} aguardando o cliente`}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="label-caps">A pagar</p>
                      <p className="resumo-valor" style={{ color: r.aPagarCentavos > 0 ? "var(--accent)" : undefined }}>
                        {centavosParaReais(r.aPagarCentavos)}
                      </p>
                    </div>
                  </div>

                  {itens.length > 0 && (
                    <details className="mt-3">
                      <summary className="link-discreto" style={{ cursor: "pointer" }}>
                        Ver de onde vem
                      </summary>
                      <ul className="mt-3 flex flex-col gap-2">
                        {itens.map((item) => {
                          const venda = item.itemVendaServico.venda;
                          return (
                            <li key={item.id} className="linha-extrato">
                              <span>
                                <Link href={`/vendas/${venda.id}`} style={{ color: "var(--accent)" }}>
                                  {venda.dataHora.toLocaleDateString("pt-BR")}
                                </Link>{" "}
                                — {item.itemVendaServico.descricao}
                                <span className="celula-sub">
                                  {venda.cliente?.nome ?? "Sem cliente"}
                                  {venda.moto ? ` · ${formatarPlaca(venda.moto.placa)}` : ""}
                                  {` · ${item.percentual / 100}% de ${centavosParaReais(item.itemVendaServico.valor)}`}
                                </span>
                              </span>
                              <strong>{centavosParaReais(item.valor)}</strong>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}

                  {podeFechar && r.aPagarCentavos > 0 && (
                    <div className="mt-4">
                      <BotaoFechar
                        mecanicoId={r.mecanico.id}
                        nome={r.mecanico.nome}
                        valorFormatado={centavosParaReais(r.aPagarCentavos)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="label-caps mb-3">Histórico de pagamentos</h2>

        {historico.length === 0 ? (
          <p className="state-empty">Nenhum fechamento feito ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historico.map((f) => (
              <li key={f.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <span>
                  <span className="font-medium">{f.mecanico.nome}</span>
                  <span className="celula-sub">
                    {f.createdAt.toLocaleDateString("pt-BR")} · {f._count.repasses} serviço(s) ·
                    período de {f.inicio.toLocaleDateString("pt-BR")} a {f.fim.toLocaleDateString("pt-BR")}
                  </span>
                </span>
                <span className="font-semibold">{centavosParaReais(f.total)}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="ajuda mt-4">
          Cada fechamento lança uma despesa em &quot;Comissões&quot;. É isso que
          faz o relatório de lucro mostrar o seu resultado de verdade: a mão de
          obra entra na venda mas sai daqui, porque não é dinheiro seu.
        </p>
      </section>
    </AppShell>
  );
}
