import { randomBytes, createCipheriv, createDecipheriv, createHash } from "crypto";

// AES-256-GCM — usado só para os tokens do Melhor Envio (access/refresh token),
// que precisam ficar recuperáveis pelo servidor (diferente de uma senha, que
// usa hash de mão única). Chave vem de INTEGRACOES_TOKEN_KEY (string
// qualquer — passamos por SHA-256 pra sempre virar 32 bytes, independente do
// tamanho/formato que o dono colar na env var).

function obterChave(): Buffer {
  const chave = process.env.INTEGRACOES_TOKEN_KEY;
  if (!chave) {
    throw new Error("INTEGRACOES_TOKEN_KEY não configurada — necessária para guardar tokens de integrações com segurança.");
  }
  return createHash("sha256").update(chave).digest();
}

// Formato armazenado: "iv:authTag:ciphertext", tudo em base64, separado por ":".
export function criptografar(textoPlano: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", obterChave(), iv);
  const ciphertext = Buffer.concat([cipher.update(textoPlano, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function descriptografar(textoCriptografado: string): string {
  const partes = textoCriptografado.split(":");
  if (partes.length !== 3) {
    throw new Error("Formato inválido de dado criptografado.");
  }
  const [ivB64, authTagB64, ciphertextB64] = partes;
  const decipher = createDecipheriv("aes-256-gcm", obterChave(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const textoPlano = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
  return textoPlano.toString("utf8");
}
