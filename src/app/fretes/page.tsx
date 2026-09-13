import Link from "next/link";
import { requireLeitura } from "@/lib/permissoes-servidor";
import { podeEscrever } from "@/lib/permissoes";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { obterStatusIntegracao } from "@/lib/integracoes/melhorEnvio/oauth";
import { melhorEnvioConfig } from "@/lib/integracoes/melhorEnvio/config";
import { CotadorFretes } from "@/components/fretes/CotadorFretes";

type SearchParams = {
  cepOrigem?: string;
  cepDestino?: string;
  pesoKg?: string;
  alturaCm?: string;
  larguraCm?: string;
  comprimentoCm?: string;
};

export default async function CotadorFretesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const usuario = await requireLeitura("fretes");
  const params = await searchParams;
  const status = await obterStatusIntegracao();
  const podeCotar = podeEscrever(usuario, "fretes");

  const temValoresIniciais = Boolean(params.cepOrigem || params.cepDestino || params.pesoKg);
  const valoresIniciais = temValoresIniciais
    ? {
        cepOrigem: params.cepOrigem,
        cepDestino: params.cepDestino,
        pesoKg: params.pesoKg ? Number(params.pesoKg) : undefined,
        alturaCm: params.alturaCm ? Number(params.alturaCm) : undefined,
        larguraCm: params.larguraCm ? Number(params.larguraCm) : undefined,
        comprimentoCm: params.comprimentoCm ? Number(params.comprimentoCm) : undefined,
      }
    : undefined;

  return (
    <AppShell usuario={usuario}>
      <PageHeader
        title="Cotador de Fretes"
        action={
          <Link href="/fretes/historico" className="btn btn-outline">
            Histórico
          </Link>
        }
      />

      {status.status !== "conectado" && (
        <p className="state-error mb-6" role="alert">
          A integração com o Melhor Envio não está conectada.{" "}
          <Link href="/integracoes/melhor-envio" className="underline">
            Configure a integração
          </Link>{" "}
          antes de calcular fretes.
        </p>
      )}

      {!podeCotar ? (
        <p className="state-empty">Você não tem permissão para realizar cotações de frete.</p>
      ) : (
        <CotadorFretes cepOrigemPadrao={melhorEnvioConfig.cepOrigemPadrao} valoresIniciais={valoresIniciais} />
      )}
    </AppShell>
  );
}
