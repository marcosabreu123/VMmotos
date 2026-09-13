import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { totaisPorMecanico, socioDaOficina } from "@/lib/oficina/mecanicos";
import { podeEscrever } from "@/lib/permissoes";
import { centavosParaReais } from "@/lib/money";
import { MecanicoForm } from "./MecanicoForm";

export default async function MecanicosPage() {
  const usuario = await requireLeitura("oficina");
  const [totais, socio] = await Promise.all([totaisPorMecanico(), socioDaOficina()]);

  const semSocio = totais.length > 0 && !socio;

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Mão de obra" />

      {semSocio && (
        <p className="state-error mb-6" role="alert">
          Nenhum mecânico está marcado como sócio da oficina. Sem isso, quem
          executa o serviço leva 100% da mão de obra — a divisão de 50% não
          acontece.
        </p>
      )}

      {podeEscrever(usuario, "oficina") && (
        <section className="mb-8">
          <h2 className="label-caps mb-3">Novo mecânico</h2>
          <MecanicoForm />
        </section>
      )}

      <section>
        <h2 className="label-caps mb-3">Mecânicos</h2>

        {totais.length === 0 ? (
          <p className="state-empty">
            Nenhum mecânico cadastrado. Cadastre o pessoal da oficina para poder
            lançar mão de obra na venda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {totais.map(({ mecanico, pendenteCentavos, aPagarCentavos }) => (
              <li key={mecanico.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="font-medium">{mecanico.nome}</span>
                    {mecanico.socioOficina && (
                      <span className="badge badge-accent ml-2">Sócio</span>
                    )}
                  </span>

                  <span className="flex flex-wrap gap-4 text-sm">
                    <span>
                      <span className="label-caps block">A pagar</span>
                      <span className="font-semibold" style={{ color: "var(--accent)" }}>
                        {centavosParaReais(aPagarCentavos)}
                      </span>
                    </span>
                    <span>
                      <span className="label-caps block">Aguardando cliente</span>
                      <span style={{ color: "var(--muted)" }}>
                        {centavosParaReais(pendenteCentavos)}
                      </span>
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="ajuda mt-4">
          <strong>A pagar</strong> é o que o cliente já quitou e entra no
          fechamento da semana. <strong>Aguardando cliente</strong> é serviço
          feito que ainda não foi pago — só vira dinheiro do mecânico quando o
          cliente paga.
        </p>
      </section>
    </AppShell>
  );
}
