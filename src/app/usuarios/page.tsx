import { requireOwner } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { listarUsuarios } from "@/lib/usuarios";
import { UsuarioForm } from "./UsuarioForm";
import { ToggleAtivoButton } from "./ToggleAtivoButton";

const LABEL_PAPEL: Record<string, string> = {
  OWNER: "Dono",
  GERENTE: "Gerente",
  SELLER: "Vendedor",
  ESTOQUE: "Estoque",
  CONSULTA: "Consulta",
};

export default async function UsuariosPage() {
  const usuarioLogado = await requireOwner();
  const usuarios = await listarUsuarios();

  return (
    <AppShell usuario={usuarioLogado}>
        <PageHeader title="Usuários" />

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Novo usuário</h2>
          <UsuarioForm />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Equipe</h2>
          <ul className="flex flex-col gap-2">
            {usuarios.map((usuario) => (
              <li key={usuario.id} className="card flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">
                    {usuario.nome} {!usuario.ativo && <span className="badge badge-danger ml-2">Inativo</span>}
                  </p>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>
                    {usuario.email} · {LABEL_PAPEL[usuario.papel] ?? usuario.papel}
                  </p>
                </div>
                {usuario.id !== usuarioLogado.id && (
                  <ToggleAtivoButton usuarioId={usuario.id} ativo={usuario.ativo} />
                )}
              </li>
            ))}
          </ul>
        </section>
    </AppShell>
  );
}
