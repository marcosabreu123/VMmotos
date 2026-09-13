import { redirect } from "next/navigation";

/**
 * A tela de Estoque foi fundida com a de Peças.
 *
 * Eram duas listas das mesmas peças com nomes diferentes, e o dono pediu uma
 * só, chamada "Peças". A rota continua existindo e redirecionando porque
 * outras telas do molde ainda apontam para /estoque — e porque quem já
 * salvou o endereço não pode cair num 404.
 */
export default function EstoquePage() {
  redirect("/produtos");
}
