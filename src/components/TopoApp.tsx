"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { IconHome, IconLogout, IconVoltar } from "./icons";
import { useEffect, type ReactNode } from "react";
import { nicho } from "@/config/nicho";
import type { SessaoUsuario } from "@/lib/types";
import { LABEL_PAPEL } from "@/lib/permissoes";

/**
 * Topo do app — substituiu o menu lateral a pedido do dono.
 *
 * Toda a navegação mora nos atalhos da tela inicial; aqui fica só o que a
 * pessoa precisa em qualquer página: voltar ao início e sair. O botão traz a
 * palavra "Início" junto do ícone de propósito — casinha sozinha é símbolo
 * que nem todo mundo lê, e quem opera esta loja não é usuário de sistema.
 */

const CHAVE_TRILHA = "vm:trilha";

/** sessionStorage é por aba e some ao fechar — é exatamente o tempo de vida
 *  que a trilha precisa ter. Pode falhar em aba anônima, então nunca quebra. */
function lerTrilha(): string[] {
  try {
    const bruto = sessionStorage.getItem(CHAVE_TRILHA);
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function gravarTrilha(trilha: string[]) {
  try {
    sessionStorage.setItem(CHAVE_TRILHA, JSON.stringify(trilha));
  } catch {
    // storage bloqueado — o botão continua funcionando, caindo no Início
  }
}

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return partes
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function TopoApp({ usuario, sino }: { usuario: SessaoUsuario; sino: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Na própria tela inicial nem "Voltar" nem "Início" fariam sentido — saem,
  // e a marca ocupa o lugar deles.
  const naTelaInicial = pathname === "/dashboard";

  // Guarda por onde o dono passou DENTRO do app, nesta aba.
  //
  // Não dá para usar o voltar do navegador: ele conhece a página em branco de
  // antes do app, e quem abre uma tela direto numa aba nova (é o que o botão
  // "Cadastrar em outra aba" faz, na venda) sairia do sistema no primeiro
  // clique. Testei: caía em about:blank. Com a trilha própria o botão nunca
  // leva para fora — no pior caso leva para o Início.
  useEffect(() => {
    const trilha = lerTrilha();
    if (trilha[trilha.length - 1] !== pathname) {
      // Só as últimas telas interessam; guardar tudo só encheria o storage.
      gravarTrilha([...trilha, pathname].slice(-20));
    }
  }, [pathname]);

  function voltar() {
    const trilha = lerTrilha();
    // Tira a tela atual; o que sobrar no topo é a anterior.
    if (trilha[trilha.length - 1] === pathname) trilha.pop();
    const anterior = trilha[trilha.length - 1];
    gravarTrilha(trilha);
    router.push(anterior ?? "/dashboard");
  }

  return (
    <header className="topo-app no-print">
      {!naTelaInicial && (
        <button type="button" onClick={voltar} className="topo-inicio" aria-label="Voltar para a tela anterior">
          <IconVoltar width={18} height={18} />
          Voltar
        </button>
      )}

      {!naTelaInicial && (
        <Link href="/dashboard" className="topo-inicio topo-inicio-secundario">
          <IconHome width={18} height={18} />
          <span className="topo-inicio-texto">Início</span>
        </Link>
      )}

      <Link href="/dashboard" className="topo-marca">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={nicho.negocio.logoPath} alt={nicho.negocio.nome} />
        <span className="topo-marca-nome">{nicho.negocio.nome}</span>
      </Link>

      <div className="topo-direita">
        {sino}
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
