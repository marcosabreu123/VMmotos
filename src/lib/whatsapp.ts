import { centavosParaReais } from "./money";
import { nicho } from "@/config/nicho";

// Sempre um link manual (o usuário clica e decide se envia) — nunca disparo automático.
export function montarLinkWhatsApp(telefone: string | null, mensagem: string): string | null {
  if (!telefone) return null;

  const numeroLimpo = telefone.replace(/\D/g, "");
  if (!numeroLimpo) return null;
  const numeroComDDI = numeroLimpo.startsWith("55") ? numeroLimpo : `55${numeroLimpo}`;

  return `https://wa.me/${numeroComDDI}?text=${encodeURIComponent(mensagem)}`;
}

export function montarLinkWhatsAppResumoVenda(
  telefone: string | null,
  nomeCliente: string | null,
  itens: { nome: string; quantidade: number }[],
  total: number
): string | null {
  const linhas = [
    `Olá${nomeCliente ? " " + nomeCliente : ""}! Aqui está o resumo da sua compra na ${nicho.negocio.nome}:`,
    ...itens.map((item) => `${item.quantidade}x ${item.nome}`),
    `Total: ${centavosParaReais(total)}`,
    "Obrigado pela preferência!",
  ];
  return montarLinkWhatsApp(telefone, linhas.join("\n"));
}
