import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth";

export default async function HomePage() {
  const usuario = await usuarioAtual();
  redirect(usuario ? "/dashboard" : "/login");
}
