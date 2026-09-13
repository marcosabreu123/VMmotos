"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { BrandDivider } from "./BrandDivider";
import { podeLer, podeEscrever, type Recurso } from "@/lib/permissoes";
import {
  IconDashboard,
  IconVender,
  IconProdutos,
  IconClientes,
  IconFornecedores,
  IconCompras,
  IconEstoque,
  IconRelatorios,
  IconUsuarios,
  IconAuditoria,
  IconDespesas,
  IconDinheiro,
  IconChat,
  IconFrete,
  IconLogout,
  IconMenu,
  IconClose,
} from "./icons";
import type { SessaoUsuario } from "@/lib/types";
import { nicho } from "@/config/nicho";

const LABEL_PAPEL: Record<SessaoUsuario["papel"], string> = {
  OWNER: "Dono",
  GERENTE: "Gerente",
  SELLER: "Vendedor",
  ESTOQUE: "Estoque",
  CONSULTA: "Consulta",
};

const GRUPOS: Array<{
  titulo: string;
  links: Array<{ href: string; label: string; Icon: typeof IconDashboard; recurso?: Recurso }>;
}> = [
  {
    titulo: "Visão geral",
    links: [{ href: "/dashboard", label: "Dashboard", Icon: IconDashboard }],
  },
  {
    titulo: "Comercial",
    links: [
      { href: "/vendas", label: "Vendas", Icon: IconVender, recurso: "vendas" },
      { href: "/clientes", label: "Clientes", Icon: IconClientes, recurso: "clientes" },
      { href: "/produtos", label: "Produtos", Icon: IconProdutos, recurso: "produtos" },
    ],
  },
  {
    titulo: "Operacional",
    links: [
      { href: "/estoque", label: "Estoque", Icon: IconEstoque, recurso: "estoque" },
      { href: "/compras", label: "Compras", Icon: IconCompras, recurso: "compras" },
      { href: "/fornecedores", label: "Fornecedores", Icon: IconFornecedores, recurso: "fornecedores" },
      { href: "/fretes", label: "Cotador de Fretes", Icon: IconFrete, recurso: "fretes" },
    ],
  },
  {
    titulo: "Financeiro",
    links: [
      { href: "/despesas", label: "Despesas", Icon: IconDespesas, recurso: "despesas" },
      { href: "/clientes/debitos", label: "Clientes em débito", Icon: IconDinheiro, recurso: "clientes" },
    ],
  },
];

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeiras = partes.slice(0, 2).map((parte) => parte[0]?.toUpperCase() ?? "");
  return primeiras.join("") || "?";
}

export function Sidebar({ usuario }: { usuario: SessaoUsuario }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);

  const grupoGestao = {
    titulo: "Gestão",
    links: [
      { href: "/relatorios", label: "Relatórios", Icon: IconRelatorios, recurso: "relatorios" as const },
      ...(usuario.papel === "OWNER"
        ? [
            { href: "/usuarios", label: "Usuários", Icon: IconUsuarios, recurso: undefined },
            { href: "/auditoria", label: "Auditoria", Icon: IconAuditoria, recurso: undefined },
            { href: "/assistente/configuracoes", label: "Assistente de IA", Icon: IconChat, recurso: undefined },
            { href: "/integracoes/melhor-envio", label: "Melhor Envio", Icon: IconFrete, recurso: undefined },
          ]
        : []),
    ],
  };

  const grupos = [...GRUPOS, grupoGestao]
    .map((grupo) => ({
      ...grupo,
      links: grupo.links.filter((link) => !link.recurso || podeLer(usuario, link.recurso)),
    }))
    .filter((grupo) => grupo.links.length > 0);

  const podeVender = podeEscrever(usuario, "vendas");

  return (
    <>
      <div className="sidebar-topbar">
        <button
          type="button"
          className="sidebar-menu-btn"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
        >
          <IconMenu />
        </button>
        <div className="sidebar-topbar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={nicho.negocio.logoPath} alt={nicho.negocio.nome} />
          <span className="font-serif text-lg font-bold">{nicho.negocio.nome}</span>
        </div>
        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
          {iniciaisDoNome(usuario.nome)}
        </div>
      </div>

      {aberto && <div className="sidebar-backdrop" onClick={() => setAberto(false)} />}

      <aside className={`sidebar ${aberto ? "sidebar-open" : ""}`}>
        <button
          type="button"
          className="sidebar-close-btn"
          onClick={() => setAberto(false)}
          aria-label="Fechar menu"
        >
          <IconClose />
        </button>

        <div className="sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={nicho.negocio.logoPath} alt={nicho.negocio.nome} />
          <span className="font-serif text-lg font-bold">{nicho.negocio.nome}</span>
        </div>
        <div className="px-5">
          <BrandDivider />
        </div>

        {podeVender && (
          <div className="px-3 pt-4 pb-2">
            <Link href="/vendas/nova" className="btn btn-primary btn-block" onClick={() => setAberto(false)}>
              <IconVender />
              Nova venda
            </Link>
          </div>
        )}

        <nav className="sidebar-nav">
          {grupos.map((grupo) => (
            <div key={grupo.titulo} className="sidebar-grupo">
              <p className="label-caps sidebar-grupo-titulo">{grupo.titulo}</p>
              {grupo.links.map(({ href, label, Icon }) => {
                const ativo = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar-link ${ativo ? "sidebar-link-active" : ""}`}
                    onClick={() => setAberto(false)}
                  >
                    <Icon />
                    <span className="label-caps" style={{ color: "inherit" }}>
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{iniciaisDoNome(usuario.nome)}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{usuario.nome}</p>
              <p className="label-caps">{LABEL_PAPEL[usuario.papel]}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-outline btn-block">
              <IconLogout />
              Sair
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
