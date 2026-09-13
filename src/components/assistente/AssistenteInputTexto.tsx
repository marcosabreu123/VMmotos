import { useEffect, useRef } from "react";
import { IconSend } from "@/components/icons";

// Altura máxima do campo antes de ele próprio rolar (~6 linhas): cresce com o
// texto, mas nunca a ponto de engolir a conversa.
const ALTURA_MAXIMA_PX = 140;

export function AssistenteInputTexto({
  valor,
  onChange,
  onEnviar,
  desabilitado,
}: {
  valor: string;
  onChange: (valor: string) => void;
  onEnviar: () => void;
  desabilitado: boolean;
}) {
  const campoRef = useRef<HTMLTextAreaElement>(null);

  // Cresce conforme o texto. Precisa zerar antes de medir, senão a altura só
  // aumenta e nunca volta quando o usuário apaga.
  useEffect(() => {
    const campo = campoRef.current;
    if (!campo) return;
    campo.style.height = "auto";
    campo.style.height = `${Math.min(campo.scrollHeight, ALTURA_MAXIMA_PX)}px`;
  }, [valor]);

  return (
    <div className="assistente-input-linha">
      {/* textarea, não input: um input não aceita quebra de linha, então
          Shift+Enter não tinha como funcionar, e um texto longo ficava rolando
          na horizontal — só dava para ver o final do que foi digitado. */}
      <textarea
        ref={campoRef}
        className="input assistente-campo-texto"
        placeholder="Pergunte algo ao assistente..."
        value={valor}
        disabled={desabilitado}
        rows={1}
        onChange={(evento) => onChange(evento.target.value)}
        onKeyDown={(evento) => {
          // Enter envia; Shift+Enter (ou Ctrl/Cmd+Enter) quebra linha.
          if (evento.key === "Enter" && !evento.shiftKey && !evento.ctrlKey && !evento.metaKey) {
            evento.preventDefault();
            onEnviar();
          }
        }}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={desabilitado || !valor.trim()}
        onClick={onEnviar}
        aria-label="Enviar mensagem"
      >
        {desabilitado ? <span className="spinner" /> : <IconSend />}
      </button>
    </div>
  );
}
