import { Suspense, type ReactNode } from "react";
import { TopoApp } from "./TopoApp";
import { SinoAlertas } from "./SinoAlertas";
import { listarAlertas } from "@/lib/alertas";
import type { SessaoUsuario } from "@/lib/types";

/**
 * Os alertas ficam dentro de um Suspense próprio.
 *
 * Sem isto, a consulta do sininho entrava no caminho crítico de TODA tela: a
 * página terminava de carregar os próprios dados e só então esperava os
 * alertas, somando os dois tempos. Agora a tela aparece e o sino se completa
 * sozinho — o dono não fica olhando para o nada por causa de um contador.
 */
async function SinoCarregado({ usuario }: { usuario: SessaoUsuario }) {
  const alertas = await listarAlertas(usuario);
  return <SinoAlertas alertas={alertas} />;
}

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
      <TopoApp
        usuario={usuario}
        sino={
          // O fallback é o próprio sino vazio: o topo não "pula" quando os
          // alertas chegam, porque o espaço já está reservado do tamanho certo.
          <Suspense fallback={<SinoAlertas alertas={[]} carregando />}>
            <SinoCarregado usuario={usuario} />
          </Suspense>
        }
      />
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
