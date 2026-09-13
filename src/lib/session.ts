import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import type { SessaoUsuario } from "./types";

export type SessionData = {
  usuario?: SessaoUsuario;
};

const senhaSessao = process.env.SESSION_SECRET;
if (!senhaSessao || senhaSessao.length < 32) {
  throw new Error(
    "SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres). Configure no .env."
  );
}

export const sessionOptions: SessionOptions = {
  password: senhaSessao,
  cookieName: "erp_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
