import { requireLeitura } from "@/lib/permissoes-servidor";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { socioDaOficina } from "@/lib/oficina/mecanicos";
import { MecanicoForm } from "./MecanicoForm";
import { MecanicoLinha, type MecanicoLinhaProps } from "./MecanicoLinha";
import { TiposServico } from "./TiposServico";
import { listarTiposServico } from "@/lib/oficina/tiposServico";
import { ehAdministrador } from "@/lib/permissoes";

/**
 * Mão de obra — cadastro e administração dos mecânicos.
 *
 * Lista inclui arquivados, porque quem administra precisa poder reativar
 * alguém que voltou a trabalhar na loja.
 */
export default async function MecanicosPage() {
  const usuario = await requireLeitura("oficina");
  const ehDono = ehAdministrador(usuario.papel);

  const [mecanicos, agrupado, socio] = await Promise.all([
    prisma.mecanico.findMany({
      orderBy: [{ ativo: "desc" }, { socioOficina: "desc" }, { nome: "asc" }],
      include: { _count: { select: { repasses: true } } },
    }),
    prisma.repasseMaoDeObra.groupBy({
      by: ["mecanicoId", "status"],
      where: { status: { in: ["PENDENTE", "A_PAGAR"] } },
      _sum: { valor: true },
    }),
    socioDaOficina(),
  ]);

  const tipos = await listarTiposServico();

  const linhas: MecanicoLinhaProps[] = mecanicos.map((m) => {
    const doMecanico = agrupado.filter((l) => l.mecanicoId === m.id);
    const somaDe = (status: string) =>
      doMecanico.find((l) => l.status === status)?._sum.valor ?? 0;

    return {
      id: m.id,
      nome: m.nome,
      socioOficina: m.socioOficina,
      ativo: m.ativo,
      temHistorico: m._count.repasses > 0,
      pendenteCentavos: somaDe("PENDENTE"),
      aPagarCentavos: somaDe("A_PAGAR"),
    };
  });

  const temAlgum = mecanicos.some((m) => m.ativo);

  return (
    <AppShell usuario={usuario}>
      <PageHeader title="Mão de obra" />

      {temAlgum && !socio && (
        <p className="state-error mb-6" role="alert">
          Nenhum mecânico está marcado como sócio da oficina. Sem isso, quem
          executa o serviço leva 100% da mão de obra — a divisão de 50% não
          acontece.
        </p>
      )}

      {ehDono && (
        <section className="mb-8">
          <h2 className="label-caps mb-3">Novo mecânico</h2>
          <MecanicoForm />
        </section>
      )}

      <TiposServico iniciais={tipos.map((t) => ({ id: t.id, nome: t.nome, valorSugerido: t.valorSugerido }))} podeEditar={ehDono} />

      <section>
        <h2 className="label-caps mb-3">Mecânicos</h2>

        {linhas.length === 0 ? (
          <p className="state-empty">
            Nenhum mecânico cadastrado. Cadastre o pessoal da oficina para poder
            lançar mão de obra na venda.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {linhas.map((linha) =>
              ehDono ? (
                <MecanicoLinha key={linha.id} mecanico={linha} />
              ) : (
                // Quem não é dono vê a lista, mas não administra.
                <li key={linha.id} className="card p-4">
                  <span className="font-medium">{linha.nome}</span>
                  {linha.socioOficina && <span className="badge badge-accent ml-2">Sócio</span>}
                  {!linha.ativo && <span className="badge ml-2">Arquivado</span>}
                </li>
              )
            )}
          </ul>
        )}

        <p className="ajuda mt-4">
          <strong>A pagar</strong> é o que o cliente já quitou e entra no
          fechamento da semana. <strong>Aguardando cliente</strong> é serviço
          feito que ainda não foi pago — só vira dinheiro do mecânico quando o
          cliente paga.
        </p>

        {ehDono && (
          <p className="ajuda">
            Mecânico que já teve mão de obra lançada não pode ser excluído, só
            arquivado: apagar tiraria o nome dele de serviços já registrados.
          </p>
        )}
      </section>
    </AppShell>
  );
}
