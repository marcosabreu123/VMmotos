"use client";

import { useEffect, useRef, useState } from "react";
import { IconClose } from "@/components/icons";
import type { SessaoUsuario } from "@/lib/types";
import { AssistenteMensagem } from "./AssistenteMensagem";
import { AssistenteInputTexto } from "./AssistenteInputTexto";
import { AssistenteBotaoMic } from "./AssistenteBotaoMic";
import { nicho } from "@/config/nicho";

type MensagemUI = {
  papel: "user" | "assistant";
  texto: string;
  aguardandoConfirmacao?: boolean;
  nivelConfirmacao?: 1 | 2 | 3;
};
type EstadoPainel = "ocioso" | "enviando" | "erro";

export function AssistentePainel({
  usuario,
  aberto,
  onFechar,
}: {
  usuario: SessaoUsuario;
  aberto: boolean;
  onFechar: () => void;
}) {
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemUI[]>([]);
  const [inputTexto, setInputTexto] = useState("");
  const [transcricaoOriginal, setTranscricaoOriginal] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoPainel>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const criandoConversaRef = useRef(false);

  useEffect(() => {
    if (!aberto || conversaId || criandoConversaRef.current) return;
    criandoConversaRef.current = true;
    fetch("/api/assistente/conversas", { method: "POST" })
      .then((resposta) => resposta.json())
      .then((conversa) => setConversaId(conversa.id))
      .catch(() => setErro("Não foi possível iniciar o assistente agora."))
      .finally(() => {
        criandoConversaRef.current = false;
      });
  }, [aberto, conversaId]);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [mensagens, estado]);

  async function enviarMensagem(textoForcado?: string) {
    const texto = (textoForcado ?? inputTexto).trim();
    if (!texto || !conversaId || estado === "enviando") return;

    setMensagens((atual) => [
      ...atual.map((m) => ({ ...m, aguardandoConfirmacao: false })),
      { papel: "user", texto },
    ]);
    setInputTexto("");
    setEstado("enviando");
    setErro(null);
    const transcricaoDesteEnvio = transcricaoOriginal;
    setTranscricaoOriginal(null);

    try {
      const resposta = await fetch("/api/assistente/conversar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversaId,
          mensagem: texto,
          idempotencyKey: crypto.randomUUID(),
          transcricaoOriginal: transcricaoDesteEnvio ?? undefined,
        }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível processar sua mensagem.");
        setEstado("erro");
        return;
      }

      setMensagens((atual) => [
        ...atual,
        {
          papel: "assistant",
          texto: dados.resposta,
          aguardandoConfirmacao: Boolean(dados.aguardandoConfirmacao),
          nivelConfirmacao: dados.nivelConfirmacao,
        },
      ]);
      setEstado(dados.estado === "erro" ? "erro" : "ocioso");
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setEstado("erro");
    }
  }

  function novaConversa() {
    setConversaId(null);
    setMensagens([]);
    setInputTexto("");
    setEstado("ocioso");
    setErro(null);
  }

  const ultimaMensagem = mensagens[mensagens.length - 1];
  const mostrarConfirmacao = ultimaMensagem?.papel === "assistant" && ultimaMensagem.aguardandoConfirmacao && estado !== "enviando";
  const acaoCritica = ultimaMensagem?.nivelConfirmacao === 3;

  return (
    <>
      <div className="assistente-backdrop" onClick={onFechar} />
      <aside className={`assistente-painel ${aberto ? "assistente-painel-aberto" : ""}`}>
        <div className="assistente-painel-header">
          <div>
            <p className="font-semibold">Assistente {nicho.negocio.nome}</p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {usuario.nome}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-outline" onClick={novaConversa}>
              Nova conversa
            </button>
            <button
              type="button"
              className="botao-fechar"
              onClick={onFechar}
              aria-label="Fechar assistente"
            >
              <IconClose />
            </button>
          </div>
        </div>

        <div className="assistente-mensagens" ref={listaRef}>
          {/* Os exemplos citavam um perfume da loja de onde este sistema
              nasceu ("quantos Yara temos em estoque?") — numa motopeças, a
              frase não fazia sentido nenhum. */}
          {mensagens.length === 0 && (
            <p className="state-empty">
              Pergunte algo como &quot;quanto vendemos hoje?&quot; ou &quot;quantas
              pastilhas de freio temos em estoque?&quot;.
            </p>
          )}
          {mensagens.map((mensagem, indice) => (
            <AssistenteMensagem key={indice} papel={mensagem.papel} texto={mensagem.texto} />
          ))}
          {estado === "enviando" && (
            <div className="assistente-mensagem assistente-mensagem-assistente flex items-center gap-2">
              <span className="spinner" /> Pensando...
            </div>
          )}
          {mostrarConfirmacao && acaoCritica && (
            <div className="state-error" role="alert">
              <div>
                <strong>Ação crítica — não pode ser desfeita.</strong>
                <div className="flex gap-2 mt-2">
                  <button type="button" className="btn btn-primary" onClick={() => enviarMensagem("Confirmar")}>
                    Confirmar mesmo assim
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => enviarMensagem("Cancelar")}>
                    Manter como está
                  </button>
                </div>
              </div>
            </div>
          )}
          {mostrarConfirmacao && !acaoCritica && (
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary" onClick={() => enviarMensagem("Confirmar")}>
                Confirmar
              </button>
              <button type="button" className="btn btn-outline" onClick={() => enviarMensagem("Cancelar")}>
                Cancelar
              </button>
            </div>
          )}
          {erro && <p className="state-error" role="alert">{erro}</p>}
        </div>

        <div className="assistente-painel-footer">
          {transcricaoOriginal && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Transcrição do áudio — revise antes de enviar:
            </p>
          )}
          <div className="flex items-start gap-2">
            <div style={{ flex: 1 }}>
              <AssistenteInputTexto
                valor={inputTexto}
                onChange={setInputTexto}
                onEnviar={() => enviarMensagem()}
                desabilitado={estado === "enviando" || !conversaId}
              />
            </div>
            <AssistenteBotaoMic
              onTranscricaoPronta={(texto) => {
                setTranscricaoOriginal(texto);
                setInputTexto(texto);
              }}
              desabilitado={estado === "enviando" || !conversaId}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
