import { requireOwner } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { obterStatusIntegracao } from "@/lib/integracoes/melhorEnvio/oauth";
import { IntegracaoMelhorEnvioActions } from "./IntegracaoMelhorEnvioActions";

const LABEL_STATUS: Record<string, { texto: string; classe: string }> = {
  conectado: { texto: "Conectado", classe: "badge-success" },
  desconectado: { texto: "Desconectado", classe: "badge-danger" },
  reconexao_necessaria: { texto: "Reconexão necessária", classe: "badge-warning" },
  renovando: { texto: "Renovando conexão...", classe: "badge-warning" },
};

export default async function IntegracaoMelhorEnvioPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; erro?: string }>;
}) {
  const usuario = await requireOwner();
  const { status: statusQuery, erro: erroQuery } = await searchParams;
  const status = await obterStatusIntegracao();
  const conectado = status.status === "conectado";
  const infoStatus = LABEL_STATUS[status.status] ?? LABEL_STATUS.desconectado;

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Integrações" />

      {statusQuery === "sucesso" && (
        <div className="state-success mb-6" role="status">
          Conexão com o Melhor Envio realizada com sucesso.
        </div>
      )}
      {erroQuery && (
        <p className="state-error mb-6" role="alert">
          {erroQuery}
        </p>
      )}

      <div className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Melhor Envio</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Cotação de fretes — sem compra, etiqueta ou rastreamento.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${infoStatus.classe}`}>{infoStatus.texto}</span>
            {status.ambiente === "sandbox" && <span className="badge badge-warning">Ambiente de testes</span>}
          </div>
        </div>

        {status.ambiente === "sandbox" && (
          <p className="state-empty mb-4">
            As cotações atuais estão sendo realizadas no ambiente de testes do Melhor Envio.
          </p>
        )}

        {!status.configurada && (
          <p className="state-error mb-4" role="alert">
            Aguardando configuração — faltam variáveis de ambiente (MELHOR_ENVIO_CLIENT_ID, CLIENT_SECRET, REDIRECT_URI).
          </p>
        )}

        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="label-caps mb-1">Conectado em</p>
            <p className="text-sm">{status.conectadoEm ? status.conectadoEm.toLocaleString("pt-BR") : "—"}</p>
          </div>
          <div>
            <p className="label-caps mb-1">Conectado por</p>
            <p className="text-sm">{status.conectadoPorNome ?? "—"}</p>
          </div>
          <div>
            <p className="label-caps mb-1">Última renovação</p>
            <p className="text-sm">{status.renovadoEm ? status.renovadoEm.toLocaleString("pt-BR") : "—"}</p>
          </div>
          <div>
            <p className="label-caps mb-1">Expira em</p>
            <p className="text-sm">{status.expiraEm ? status.expiraEm.toLocaleString("pt-BR") : "—"}</p>
          </div>
        </div>

        <IntegracaoMelhorEnvioActions conectado={conectado} />
      </div>
    </AppShell>
  );
}
