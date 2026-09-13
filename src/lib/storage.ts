import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase/admin";

const BUCKET_PRODUTOS = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "produtos";
const BUCKET_DESPESAS = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_DESPESAS ?? "despesas";

async function uploadParaBucket(bucket: string, entidadeId: string, arquivo: File): Promise<string> {
  const extensao = extrairExtensao(arquivo.name) || "jpg";
  const caminho = `${entidadeId}/${randomUUID()}.${extensao}`;

  const { error } = await supabaseAdmin.storage.from(bucket).upload(caminho, arquivo, {
    contentType: arquivo.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(`Falha ao enviar o arquivo: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(caminho);
  return data.publicUrl;
}

export async function salvarFotoProduto(produtoId: string, arquivo: File): Promise<string> {
  return uploadParaBucket(BUCKET_PRODUTOS, produtoId, arquivo);
}

export async function salvarComprovanteDespesa(despesaId: string, arquivo: File): Promise<string> {
  return uploadParaBucket(BUCKET_DESPESAS, despesaId, arquivo);
}

// fotoPath já é a URL pública completa do Supabase Storage — nada a normalizar.
export function urlFoto(fotoPath: string | null): string | null {
  return fotoPath ?? null;
}

function extrairExtensao(nomeArquivo: string): string {
  const partes = nomeArquivo.split(".");
  return partes.length > 1 ? partes[partes.length - 1].toLowerCase() : "";
}
