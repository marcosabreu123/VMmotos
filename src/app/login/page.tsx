"use client";

import { useActionState } from "react";
import { loginAction, type EstadoLogin } from "./actions";
import { nicho } from "@/config/nicho";

const ESTADO_INICIAL: EstadoLogin = {};

export default function LoginPage() {
  const [estado, formAction, pendente] = useActionState(loginAction, ESTADO_INICIAL);

  return (
    <main className="app-shell flex min-h-screen flex-col justify-center py-10">
      <div className="mb-6 flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={nicho.negocio.logoPath} alt={nicho.negocio.nome} className="h-24 w-24 rounded-full object-cover" />
      </div>
      <div className="card p-8">
        <h1 className="font-serif mb-1 text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          {nicho.negocio.nome}
        </h1>
        <p className="label-caps mb-6">Estoque · Entre para continuar</p>

        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="voce@loja.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
            />
          </div>

          {estado.erro && (
            <p className="badge badge-danger w-fit" role="alert">
              {estado.erro}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={pendente}>
            {pendente ? <span className="spinner" /> : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
