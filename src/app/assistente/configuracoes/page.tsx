import { requireOwner } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { obterConfigAdmin, obterMetricasAssistente } from "@/lib/assistente/configAdmin";
import { ConfigAssistenteForm } from "./ConfigAssistenteForm";

export default async function ConfiguracoesAssistentePage() {
  const usuario = await requireOwner();
  const [config, metricas] = await Promise.all([obterConfigAdmin(), obterMetricasAssistente()]);

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Assistente de IA" />

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Configuração</h2>
        <ConfigAssistenteForm
          habilitado={config.habilitado}
          limiteDiarioPorUsuario={config.limiteDiarioPorUsuario}
          valorAltoCentavos={config.valorAltoCentavos}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Uso</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="card p-4">
            <p className="label-caps mb-1">Interações hoje</p>
            <p className="text-xl font-bold">{metricas.interacoesHoje}</p>
          </div>
          <div className="card p-4">
            <p className="label-caps mb-1">Erros hoje</p>
            <p className="text-xl font-bold">{metricas.interacoesComErroHoje}</p>
          </div>
          <div className="card p-4">
            <p className="label-caps mb-1">Total histórico</p>
            <p className="text-xl font-bold">{metricas.interacoesTotal}</p>
          </div>
        </div>

        {metricas.porFerramenta.length > 0 && (
          <div className="mt-4">
            <p className="label-caps mb-2">Ferramentas mais usadas</p>
            <ul className="flex flex-col gap-2">
              {metricas.porFerramenta.map((linha) => (
                <li key={linha.ferramenta} className="card flex items-center justify-between p-3">
                  <span>{linha.ferramenta}</span>
                  <span className="font-semibold">{linha.quantidade}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </AppShell>
  );
}
