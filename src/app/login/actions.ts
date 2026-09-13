"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

export type EstadoLogin = { erro?: string };

export async function loginAction(
  _estadoAnterior: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Preencha e-mail e senha." };
  }

  const resultado = await login(email, senha);
  if (!resultado.ok) {
    return { erro: resultado.erro };
  }

  redirect("/dashboard");
}
