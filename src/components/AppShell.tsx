import type { ReactNode } from "react";
import { TopoApp } from "./TopoApp";
import { listarAlertas } from "@/lib/alertas";
import type { SessaoUsuario } from "@/lib/types";

export async function AppShell({
  usuario,
  children,
  wide,
}: {
  usuario: SessaoUsuario;
  children: ReactNode;
  wide?: boolean;
}) {
  // Os alertas são calculados no servidor, a cada página: são consultas
  // rápidas de contagem, e assim o sino nunca mostra número velho.
  const alertas = await listarAlertas(usuario);

  return (
    <div className="app-layout">
      <TopoApp usuario={usuario} alertas={alertas} />
      <main className="main-content">
        <div className={`${wide ? "app-shell-wide" : "app-shell"} py-8`}>{children}</div>
      </main>
      {/* O assistente de IA NÃO fica mais no app inteiro. Por decisão do dono,
          ele existe só no lançamento de pedido (/estoque/entrada-estoque), que
          é onde ajuda de verdade — ler a nota do fornecedor. Em todas as
          outras telas o botão flutuante só tirava espaço e atenção. */}
    </div>
  );
}
