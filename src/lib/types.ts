import type { Papel } from "@prisma/client";

export type { Papel, TipoVenda, FormaPagamento, StatusVenda } from "@prisma/client";

export type SessaoUsuario = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
};
