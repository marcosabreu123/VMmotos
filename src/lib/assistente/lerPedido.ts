import OpenAI from "openai";
import { assistenteConfig, ErroAssistente } from "./config";
import { nicho } from "@/config/nicho";

/**
 * Leitura da foto do pedido do fornecedor.
 *
 * O dono fotografa a nota ou o orçamento e o sistema extrai os itens. O que
 * sai daqui NUNCA é gravado direto: vira sugestão no formulário de entrada,
 * que ele confere e salva. Foto de nota amassada, carbonada ou escrita à mão
 * erra — e errar no custo de entrada contamina o lucro de todas as vendas
 * daquele lote.
 */

export class ErroLeituraPedido extends Error {}

/** 8 MB — foto de celular moderno cabe; acima disso é PDF escaneado ou engano. */
export const TAMANHO_MAXIMO_BYTES = 8 * 1024 * 1024;

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export type ItemLido = {
  descricao: string;
  quantidade: number;
  /** centavos — custo unitário. 0 quando a foto não deixa claro. */
  custoUnitario: number;
};

export type PedidoLido = {
  fornecedor: string | null;
  /** centavos — frete da nota, quando aparece. */
  frete: number;
  itens: ItemLido[];
  /** O que o modelo não conseguiu ler com segurança. */
  observacao: string | null;
};

const INSTRUCAO = `Você lê fotos de notas fiscais, pedidos e orçamentos de fornecedores de uma ${nicho.negocio.segmento}.

Extraia SOMENTE o que está visível na imagem. Regras:
- Devolva cada item com descrição, quantidade e custo unitário.
- Custo unitário é o PREÇO DE COMPRA por unidade, não o total da linha. Se a
  nota mostrar só o total da linha, divida pela quantidade.
- Valores em reais, com ponto decimal (ex.: 12.50). Nunca use vírgula.
- Se um número estiver ilegível, use 0 e explique em "observacao". NUNCA
  invente ou estime valor.
- Frete/entrega, se aparecer como linha separada, vai em "frete", não como item.
- Não mexa nos custos por causa de imposto, desconto ou total geral: devolva o
  valor que está escrito na linha do item.
- Se houver DESCONTO, ACRÉSCIMO ou qualquer abatimento sobre a nota inteira,
  avise em "observacao" com o valor (ex.: "desconto de R$ 18,00 na nota; os
  custos abaixo estão sem ele"). O sistema não aplica esse desconto sozinho —
  quem decide é o dono, e ele só decide se souber que existe.
- Se a imagem não for uma nota/pedido, devolva itens vazio e diga isso em
  "observacao".`;

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fornecedor", "frete", "itens", "observacao"],
  properties: {
    fornecedor: { type: ["string", "null"], description: "Nome do fornecedor, se visível" },
    frete: { type: "number", description: "Frete em reais; 0 se não houver" },
    observacao: { type: ["string", "null"], description: "O que não deu para ler com segurança" },
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["descricao", "quantidade", "custoUnitario"],
        properties: {
          descricao: { type: "string" },
          quantidade: { type: "number" },
          custoUnitario: { type: "number", description: "Preço de compra por unidade, em reais" },
        },
      },
    },
  },
} as const;

function reaisParaCentavosSeguro(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export async function lerFotoDoPedido(arquivo: File): Promise<PedidoLido> {
  if (!assistenteConfig.apiKey) {
    throw new ErroAssistente("CONFIG_AUSENTE", "Assistente de IA não está configurado (OPENAI_API_KEY ausente).");
  }
  if (arquivo.size === 0) {
    throw new ErroLeituraPedido("Arquivo vazio.");
  }
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    throw new ErroLeituraPedido(
      `A foto tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB e o limite é ${TAMANHO_MAXIMO_BYTES / 1024 / 1024} MB. Tire outra com menos resolução.`
    );
  }
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    throw new ErroLeituraPedido("Envie uma foto (JPG, PNG ou WEBP).");
  }

  // A imagem vai direto para o modelo, em memória. Não é gravada em disco nem
  // no Storage: é documento de fornecedor, e guardá-la sem necessidade só
  // criaria um acervo para vazar.
  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");

  const openai = new OpenAI({ apiKey: assistenteConfig.apiKey });

  let conteudo: string | null = null;
  try {
    const resposta = await openai.chat.completions.create({
      model: assistenteConfig.model,
      messages: [
        { role: "system", content: INSTRUCAO },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os itens desta nota/pedido." },
            { type: "image_url", image_url: { url: `data:${arquivo.type};base64,${base64}` } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "pedido_lido", strict: true, schema: ESQUEMA },
      },
    });
    conteudo = resposta.choices[0]?.message?.content ?? null;
  } catch (erro) {
    throw new ErroLeituraPedido(
      erro instanceof Error && /timeout|ETIMEDOUT/i.test(erro.message)
        ? "A leitura demorou demais. Tente uma foto menor ou mais nítida."
        : "Não consegui ler a foto agora. Tente de novo em instantes."
    );
  }

  if (!conteudo) throw new ErroLeituraPedido("O leitor não devolveu nada. Tente outra foto.");

  let bruto: Record<string, unknown>;
  try {
    bruto = JSON.parse(conteudo);
  } catch {
    throw new ErroLeituraPedido("Não consegui entender o resultado da leitura. Tente outra foto.");
  }

  const itensBrutos = Array.isArray(bruto.itens) ? bruto.itens : [];
  const itens: ItemLido[] = itensBrutos
    .map((i) => {
      const item = i as Record<string, unknown>;
      const quantidade = Math.max(0, Math.round(Number(item.quantidade) || 0));
      return {
        descricao: String(item.descricao ?? "").trim(),
        quantidade,
        custoUnitario: reaisParaCentavosSeguro(item.custoUnitario),
      };
    })
    // Linha sem descrição ou sem quantidade não serve para nada no formulário.
    .filter((i) => i.descricao.length > 0 && i.quantidade > 0);

  return {
    fornecedor: typeof bruto.fornecedor === "string" && bruto.fornecedor.trim() ? bruto.fornecedor.trim() : null,
    frete: reaisParaCentavosSeguro(bruto.frete),
    itens,
    observacao: typeof bruto.observacao === "string" && bruto.observacao.trim() ? bruto.observacao.trim() : null,
  };
}
