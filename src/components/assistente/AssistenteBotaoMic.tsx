"use client";

import { useEffect, useRef, useState } from "react";
import { IconMic } from "@/components/icons";

// Teto de gravação no cliente — independente do limite de tamanho verificado
// no servidor (ASSISTENTE_AUDIO_MAX_BYTES), só evita gravar indefinidamente.
const DURACAO_MAXIMA_SEGUNDOS = 60;

type EstadoGravacao = "ocioso" | "gravando" | "transcrevendo" | "erro";

export function AssistenteBotaoMic({
  onTranscricaoPronta,
  desabilitado,
}: {
  onTranscricaoPronta: (texto: string) => void;
  desabilitado: boolean;
}) {
  const [estado, setEstado] = useState<EstadoGravacao>("ocioso");
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
      streamRef.current?.getTracks().forEach((faixa) => faixa.stop());
    };
  }, []);

  function pararTudo() {
    if (intervaloRef.current) clearInterval(intervaloRef.current);
    intervaloRef.current = null;
    streamRef.current?.getTracks().forEach((faixa) => faixa.stop());
    streamRef.current = null;
    gravadorRef.current = null;
    setSegundos(0);
  }

  async function iniciarGravacao() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      pedacosRef.current = [];

      const gravador = new MediaRecorder(stream);
      gravadorRef.current = gravador;

      gravador.ondataavailable = (evento) => {
        if (evento.data.size > 0) pedacosRef.current.push(evento.data);
      };
      gravador.onstop = () => enviarParaTranscricao();

      gravador.start();
      setEstado("gravando");

      intervaloRef.current = setInterval(() => {
        setSegundos((atual) => {
          const proximo = atual + 1;
          if (proximo >= DURACAO_MAXIMA_SEGUNDOS) {
            gravadorRef.current?.stop();
          }
          return proximo;
        });
      }, 1000);
    } catch {
      setErro("Não consegui acessar o microfone. Verifique a permissão do navegador.");
      setEstado("erro");
    }
  }

  function pararEEnviar() {
    gravadorRef.current?.stop();
  }

  function cancelarGravacao() {
    if (gravadorRef.current) {
      gravadorRef.current.onstop = null;
      gravadorRef.current.stop();
    }
    pararTudo();
    setEstado("ocioso");
  }

  async function enviarParaTranscricao() {
    const mimeType = gravadorRef.current?.mimeType || "audio/webm";
    pararTudo();
    setEstado("transcrevendo");

    const blob = new Blob(pedacosRef.current, { type: mimeType });
    if (blob.size === 0) {
      setErro("Áudio vazio — tente gravar novamente, falando mais perto do microfone.");
      setEstado("erro");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("audio", blob, "gravacao.webm");
      const resposta = await fetch("/api/assistente/audio", { method: "POST", body: formData });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível transcrever o áudio.");
        setEstado("erro");
        return;
      }

      onTranscricaoPronta(dados.transcricao);
      setEstado("ocioso");
    } catch {
      setErro("Falha de conexão ao enviar o áudio.");
      setEstado("erro");
    }
  }

  const minutos = Math.floor(segundos / 60);
  const segundosRestantes = segundos % 60;

  if (estado === "gravando") {
    return (
      <div className="flex items-center gap-2">
        <span className="state-error" style={{ padding: "6px 10px" }}>
          ● {String(minutos).padStart(2, "0")}:{String(segundosRestantes).padStart(2, "0")}
        </span>
        <button type="button" className="btn btn-outline" onClick={cancelarGravacao} aria-label="Cancelar gravação">
          Cancelar
        </button>
        <button type="button" className="btn btn-primary" onClick={pararEEnviar} aria-label="Parar e enviar">
          Parar
        </button>
      </div>
    );
  }

  if (estado === "transcrevendo") {
    return (
      <span className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
        <span className="spinner" /> Transcrevendo áudio...
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="btn btn-outline"
        onClick={iniciarGravacao}
        disabled={desabilitado}
        aria-label="Gravar áudio"
      >
        <IconMic />
      </button>
      {erro && <p className="state-error" role="alert">{erro}</p>}
    </div>
  );
}
