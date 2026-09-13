"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { IconHome, IconLogout } from "./icons";
import { nicho } from "@/config/nicho";
import type { SessaoUsuario } from "@/lib/types";

/**
 * Topo do app — substituiu o menu lateral a pedido do dono.
 *
 * Toda a navegação mora nos atalhos da tela inicial; aqui fica só o que a
 * pessoa precisa em qualquer página: voltar ao início e sair. O botão traz a
 * palavra "Início" junto do ícone de propósito — casinha sozinha é símbolo
 * que nem todo mundo lê, e quem opera esta loja não é usuário de sistema.
 */

const LABEL_PAPEL: Record<SessaoUsuario["papel"], string> = {
  OWNER: "Dono",
  GERENTE: "Gerente",
  SELLER: "Vendedor",
  ESTOQUE: "Estoque",
  CONSULTA: "Consulta",
};

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return partes
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function TopoApp({ usuario }: { usuario: SessaoUsuario }) {
  const pathname = usePathname();

  // Na própria tela inicial o botão "Início" não faria nada — sai, e a marca
  // ocupa o lugar dele.
  const naTelaInicial = pathname === "/dashboard";

  return (
    <header className="topo-app no-print">
      {!naTelaInicial && (
        <Link href="/dashboard" className="topo-inicio">
          <IconHome width={18} height={18} />
          Início
        </Link>
      )}

      <Link href="/dashboard" className="topo-marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={nicho.negocio.logoPath} alt={nicho.negocio.nome} />
        <span className="topo-marca-nome">{nicho.negocio.nome}</span>
      </Link>

      <div className="topo-direita">
        <div className="topo-usuario">
          <p className="topo-usuario-nome">{usuario.nome}</p>
          <p className="label-caps">{LABEL_PAPEL[usuario.papel]}</p>
        </div>
        <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
          {iniciaisDoNome(usuario.nome)}
        </div>
        <form action={logoutAction}>
          <button type="submit" className="topo-sair">
            <IconLogout width={17} height={17} />
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
