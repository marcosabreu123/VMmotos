"use client";

import { useState } from "react";
import { IconChat } from "@/components/icons";
import type { SessaoUsuario } from "@/lib/types";
import { AssistentePainel } from "./AssistentePainel";

export function AssistenteBotaoFlutuante({ usuario }: { usuario: SessaoUsuario }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {!aberto && (
        <button
          type="button"
          className="assistente-botao"
          onClick={() => setAberto(true)}
          aria-label="Abrir assistente de IA"
        >
          <IconChat />
        </button>
      )}
      {aberto && <AssistentePainel usuario={usuario} aberto={aberto} onFechar={() => setAberto(false)} />}
    </>
  );
}
