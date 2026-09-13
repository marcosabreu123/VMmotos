import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { AssistenteBotaoFlutuante } from "./assistente/AssistenteBotaoFlutuante";
import type { SessaoUsuario } from "@/lib/types";

export function AppShell({
  usuario,
  children,
  wide,
}: {
  usuario: SessaoUsuario;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="app-layout">
      <Sidebar usuario={usuario} />
      <main className="main-content">
        <div className={`${wide ? "app-shell-wide" : "app-shell"} py-8`}>{children}</div>
      </main>
      <AssistenteBotaoFlutuante usuario={usuario} />
    </div>
  );
}
