import { NextResponse, type NextRequest } from "next/server";
import { usuarioAtual } from "@/lib/auth";
import { assistenteConfig } from "@/lib/assistente/config";
import { obterConfigAdmin } from "@/lib/assistente/configAdmin";
import { transcreverAudio } from "@/lib/assistente/openai";

export const maxDuration = 60;

const FORMATOS_ACEITOS = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/x-m4a"];

export async function POST(request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const configAdmin = await obterConfigAdmin();
  if (!configAdmin.habilitado) {
    return NextResponse.json({ erro: "O assistente de IA está desativado no momento." }, { status: 503 });
  }

  let dadosFormulario: FormData;
  try {
    dadosFormulario = await request.formData();
  } catch {
    return NextResponse.json({ erro: "Envio de áudio inválido." }, { status: 400 });
  }

  const arquivo = dadosFormulario.get("audio");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json({ erro: "Áudio vazio ou não recebido. Tente gravar novamente." }, { status: 400 });
  }

  if (arquivo.size > assistenteConfig.audioMaxBytes) {
    return NextResponse.json(
      { erro: `Áudio muito grande (máximo ${Math.round(assistenteConfig.audioMaxBytes / 1024 / 1024)}MB).` },
      { status: 413 }
    );
  }

  if (arquivo.type && !FORMATOS_ACEITOS.some((formato) => arquivo.type.startsWith(formato))) {
    return NextResponse.json({ erro: "Formato de áudio não suportado." }, { status: 415 });
  }

  try {
    const transcricao = await transcreverAudio(arquivo);
    if (!transcricao.trim()) {
      return NextResponse.json({ erro: "Não consegui entender o áudio. Tente gravar de novo, falando mais perto do microfone." }, { status: 422 });
    }
    return NextResponse.json({ transcricao: transcricao.trim() });
  } catch (erro) {
    return NextResponse.json(
      { erro: erro instanceof Error ? erro.message : "Não foi possível transcrever o áudio agora." },
      { status: 502 }
    );
  }
}
