import type { Papel } from "@prisma/client";
import type { SessaoUsuario } from "./types";

export type Recurso =
  | "vendas"
  | "produtos"
  | "clientes"
  | "fornecedores"
  | "compras"
  | "estoque"
  | "relatorios"
  | "usuarios"
  | "despesas"
  | "fretes"
  | "motos"
  | "oficina";

export type Nivel = "nenhum" | "leitura" | "escrita";

const TUDO_ESCRITA: Record<Recurso, Nivel> = {
  vendas: "escrita",
  produtos: "escrita",
  clientes: "escrita",
  fornecedores: "escrita",
  compras: "escrita",
  estoque: "escrita",
  relatorios: "escrita",
  usuarios: "escrita",
  despesas: "escrita",
  fretes: "escrita",
  motos: "escrita",
  oficina: "escrita",
};

// Matriz simples recurso × papel × nível — não é uma ACL genérica, é o
// suficiente para uma loja única com poucos papéis fixos.
const MATRIZ: Record<Papel, Record<Recurso, Nivel>> = {
  OWNER: TUDO_ESCRITA,
  GERENTE: { ...TUDO_ESCRITA, usuarios: "nenhum" },
  SELLER: {
    vendas: "escrita",
    clientes: "escrita",
    produtos: "leitura",
    fornecedores: "leitura",
    estoque: "leitura",
    compras: "nenhum",
    relatorios: "nenhum",
    usuarios: "nenhum",
    despesas: "nenhum",
    fretes: "escrita",
    motos: "escrita",
    oficina: "nenhum",
  },
  ESTOQUE: {
    produtos: "escrita",
    fornecedores: "escrita",
    compras: "escrita",
    estoque: "escrita",
    vendas: "nenhum",
    clientes: "nenhum",
    relatorios: "nenhum",
    usuarios: "nenhum",
    despesas: "nenhum",
    fretes: "escrita",
    motos: "leitura",
    oficina: "nenhum",
  },
  CONSULTA: {
    vendas: "leitura",
    produtos: "leitura",
    clientes: "leitura",
    fornecedores: "leitura",
    compras: "leitura",
    estoque: "leitura",
    relatorios: "leitura",
    usuarios: "nenhum",
    despesas: "leitura",
    fretes: "leitura",
    motos: "leitura",
    oficina: "leitura",
  },
};

export class ErroPermissao extends Error {}

export function nivelPermissao(papel: Papel, recurso: Recurso): Nivel {
  return MATRIZ[papel][recurso];
}

export function podeLer(usuario: SessaoUsuario, recurso: Recurso): boolean {
  return nivelPermissao(usuario.papel, recurso) !== "nenhum";
}

export function podeEscrever(usuario: SessaoUsuario, recurso: Recurso): boolean {
  return nivelPermissao(usuario.papel, recurso) === "escrita";
}

// Visibilidade de custo/lucro/margem não é um recurso — é uma checagem pontual de
// campo, independente da matriz, para não expor essa informação ao Vendedor por padrão.
export function podeVerCustos(papel: Papel): boolean {
  return papel !== "SELLER";
}

/**
 * Venda cancelada some para quem só opera o balcão.
 *
 * Decisão do dono da VM: cancelamento é assunto dele. Quem vende não precisa
 * ver o que foi desfeito, e a lista fica limpa do que não vale mais.
 *
 * Quem aplica isto é a camada de dados (listarVendas/vendasRecentes), não
 * cada tela — assim uma tela nova não nasce vazando o que deveria esconder.
 */
export function podeVerVendasCanceladas(papel: Papel): boolean {
  return papel !== "SELLER";
}
