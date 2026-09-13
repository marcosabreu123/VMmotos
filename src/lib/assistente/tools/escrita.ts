import type { ClassificacaoDespesa, FormaPagamento, FormaPagamentoDespesa, TipoRecorrencia } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buscarClientes, buscarClientePorId } from "@/lib/clientes";
import { buscarProdutoPorId, buscarProdutoPorSku, buscarProdutosParaVenda, estoqueTotalProduto } from "@/lib/produtos";
import { buscarFornecedorPorId, listarFornecedores } from "@/lib/fornecedores";
import { listarCategoriasDespesa } from "@/lib/despesas";
import { ratearFreteUniforme } from "@/lib/entradaEstoque";
import { buscarVendaPorId } from "@/lib/vendas";
import type { TipoAjuste } from "@/lib/estoque";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";
import { cotarFrete, ordenarOpcoes, type DadosCotacao } from "@/lib/integracoes/melhorEnvio/cotacao";
import { registrarCotacao } from "@/lib/integracoes/melhorEnvio/historico";
import { melhorEnvioConfig } from "@/lib/integracoes/melhorEnvio/config";
import { ErroMelhorEnvio } from "@/lib/integracoes/melhorEnvio/client";
import { ErroOAuthMelhorEnvio } from "@/lib/integracoes/melhorEnvio/oauth";
import { registrarAuditoria } from "@/lib/auditoria";
import { resolverDataRelativa } from "../datas";
import { nicho, rotuloMedida } from "@/config/nicho";
import type { FerramentaAssistente } from "../types";

/** Categorias já configuradas para o nicho, para orientar o modelo no cadastro. */
function categoriasSugeridas(): string {
  const cats = nicho.categoriasProdutoIniciais;
  return cats.length > 0 ? ` (ex: ${cats.join(", ")})` : "";
}

const TIPOS_AJUSTE: TipoAjuste[] = ["AJUSTE_POSITIVO", "AJUSTE_NEGATIVO", "PERDA_VENCIMENTO", "PERDA_DEFEITO", "BRINDE"];
const LABEL_TIPO_AJUSTE: Record<TipoAjuste, string> = {
  AJUSTE_POSITIVO: "ajuste positivo",
  AJUSTE_NEGATIVO: "ajuste negativo",
  PERDA_VENCIMENTO: "perda por vencimento",
  PERDA_DEFEITO: "perda por defeito",
  BRINDE: "baixa (brinde/amostra)",
};

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

function numero(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  return undefined;
}

function paraCentavos(valor: unknown): number | undefined {
  const str = texto(valor);
  if (str === undefined) return undefined;
  return reaisParaCentavos(str);
}

// Converte "hoje"/"ontem"/"2026-07-20" para um Date; datas por extenso mais
// elaboradas já chegam resolvidas pelo próprio modelo (que recebeu a data de
// hoje no system prompt).
function paraData(valor: unknown): Date | undefined {
  const str = texto(valor);
  if (str === undefined) return undefined;
  const isoResolvido = resolverDataRelativa(str) ?? str;
  const data = new Date(`${isoResolvido}T12:00:00`);
  return Number.isNaN(data.getTime()) ? undefined : data;
}


// SKU automático seguindo o padrão que já existe no catálogo
// sigla da marca, nome abreviado
// e tamanho. O dono nunca dita SKU ao lançar um pedido, mas o campo é único e
// obrigatório — sem gerar aqui, cadastrar produto pela conversa seria inviável.
function apenasLetras(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function siglaMarca(marca: string): string {
  const palavras = marca.trim().split(/\s+/).filter(Boolean);
  if (palavras.length > 1) {
    // marca composta vira iniciais: "Isabelle La Belle" -> ILB
    return palavras.map((p) => apenasLetras(p).charAt(0)).join("").slice(0, 4) || "MRC";
  }
  return apenasLetras(palavras[0] ?? "").slice(0, 4) || "MRC";
}

async function gerarSkuUnico(
  marca: string,
  nome: string,
  medida: number | null,
  jaUsadosNestaLeva: Set<string>
): Promise<string> {
  const base = [siglaMarca(marca), apenasLetras(nome).slice(0, 10), medida ? String(medida) : ""]
    .filter(Boolean)
    .join("-");

  let candidato = base;
  for (let sufixo = 2; sufixo < 50; sufixo++) {
    const colideNaLeva = jaUsadosNestaLeva.has(candidato);
    const colideNoBanco = colideNaLeva ? null : await prisma.produto.findUnique({ where: { sku: candidato } });
    if (!colideNaLeva && !colideNoBanco) return candidato;
    candidato = `${base}-${sufixo}`;
  }
  // saída de emergência: sufixo aleatório em vez de laço infinito
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * Procura um produto já cadastrado equivalente ao que se quer criar.
 *
 * O tamanho só entra na comparação quando foi informado. Foi exatamente aí que
 * duplicatas passaram: o produto já existia com um tamanho, o assistente
 * mandou sem tamanho, a busca exigia tamanho igual (null ≠ valor) e um
 * segundo cadastro nascia. Sem tamanho informado, nome+marca reconhecem o
 * produto — e se houver mais de um tamanho cadastrado, a resposta é perguntar,
 * nunca criar mais um.
 */
async function procurarProdutoEquivalente(
  nome: string,
  marca: string,
  medida: number | null
): Promise<
  | { tipo: "nenhum" }
  | { tipo: "existe"; produto: { id: string; nome: string; marca: string; categoria: string; medida: number | null; sku: string } }
  | { tipo: "ambiguo"; candidatos: Array<{ nome: string; marca: string; categoria: string; medida: number | null; sku: string }> }
> {
  // unaccent + lower + trim: "  Produto Ã " e "produto a" são o mesmo produto.
  const candidatos = await prisma.$queryRaw<
    Array<{ id: string; nome: string; marca: string; categoria: string; medida: number | null; sku: string }>
  >`
    SELECT id, nome, marca, categoria, "medida", sku FROM "Produto"
    WHERE unaccent(lower(btrim(nome))) = unaccent(lower(btrim(${nome})))
      AND unaccent(lower(btrim(marca))) = unaccent(lower(btrim(${marca})))
    ORDER BY "medida" NULLS FIRST
  `;

  if (candidatos.length === 0) return { tipo: "nenhum" };

  if (medida !== null) {
    const mesmoTamanho = candidatos.find((c) => c.medida === medida);
    // Tamanho informado e diferente de tudo que existe: é produto novo mesmo
    // (uma variação de tamanho não é a outra).
    return mesmoTamanho ? { tipo: "existe", produto: mesmoTamanho } : { tipo: "nenhum" };
  }

  if (candidatos.length === 1) return { tipo: "existe", produto: candidatos[0] };
  return { tipo: "ambiguo", candidatos };
}

export const ferramentasEscrita: FerramentaAssistente[] = [
  {
    nome: "create_customer_preview",
    descricao:
      "Monta a prévia de um novo cliente para confirmação (Nível 2 — precisa de confirmação explícita do usuário antes de criar de verdade). Nunca cria o cliente sozinho, só devolve a prévia. IMPORTANTE: use esta ferramenta SÓ quando o pedido for exclusivamente cadastrar um cliente, sem nenhuma venda junto. Se o pedido também envolver uma venda para esse cliente (ex: 'cliente X comprou Y, cadastre o cliente e a venda'), NÃO chame esta ferramenta — chame create_sale_preview diretamente, preenchendo o campo novoCliente com os dados do cliente. Isso monta cliente+venda numa prévia e confirmação só, em vez de duas.",
    recurso: "clientes",
    nivel: 2,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        nome: { type: "string" },
        telefone: { type: "string" },
        email: { type: "string" },
      },
      required: ["nome"],
    },
    handler: async (args) => {
      const nome = texto(args.nome);
      if (!nome) {
        return { success: false, error_code: "NOME_OBRIGATORIO", message: "Preciso do nome do cliente para continuar." };
      }
      const telefone = texto(args.telefone) ?? null;
      const email = texto(args.email) ?? null;

      const parecidos = await buscarClientes(nome);
      const warnings = parecidos.length > 0 ? [`Já existe cliente parecido: ${parecidos.map((c) => c.nome).join(", ")}.`] : undefined;

      return {
        success: true,
        data: {
          nome,
          telefone: telefone ?? "não informado",
          email: email ?? "não informado",
          resolvido: { nome, telefone, email },
        },
        warnings,
        message: `Confira os dados antes de cadastrar: ${nome}${telefone ? `, telefone ${telefone}` : ""}. Confirma o cadastro?`,
      };
    },
  },
  {
    nome: "create_sale_preview",
    descricao:
      "Monta a prévia de uma venda para confirmação (Nível 2). Os produtos devem ser informados com o produtoId já resolvido via search_products. Se o cliente ainda não existe, informe novoCliente em vez de clienteId — a prévia mostrará a criação do cliente e a venda juntas NUMA SÓ prévia/confirmação (nunca chame create_customer_preview antes, nesse caso). Se a forma de pagamento não for mencionada, pode omitir — o padrão é PIX, e a prévia avisa isso claramente.",
    recurso: "vendas",
    nivel: 2,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              produtoId: { type: "string" },
              quantidade: { type: "number", description: "Se o usuário não disser a quantidade, omita — o padrão é 1." },
              precoUnitario: {
                type: "string",
                description:
                  "Preço POR UNIDADE efetivamente combinado com o cliente, em reais (ex: '229,00'). Use sempre que o usuário disser por quanto o item saiu — tanto mais barato quanto mais caro que o cadastro. Omita quando ele não citar preço, para usar o do cadastro. NUNCA converta esse valor em desconto você mesmo.",
              },
              descontoItem: { type: "string", description: "Desconto em reais sobre o item, ex: '10,00'. Use só quando o usuário falar em desconto explicitamente. Se ele disser o preço final, use precoUnitario." },
            },
            required: ["produtoId"],
          },
        },
        clienteId: { type: "string", description: "Omita se a venda não tem cliente identificado — venda avulsa é normal." },
        novoCliente: {
          type: "object",
          properties: { nome: { type: "string" }, telefone: { type: "string" }, email: { type: "string" } },
        },
        formaPagamento: {
          type: "string",
          enum: ["DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO", "PIX"],
          description: "Se o usuário não mencionar a forma de pagamento, pode omitir este campo — o padrão é PIX.",
        },
        descontoTotal: { type: "string", description: "Desconto geral em reais, ex: '20,00'" },
        acrescimoTotal: { type: "string", description: "Acréscimo geral em reais, ex: '10,00'" },
        dataVenda: { type: "string", description: "Data da venda (ISO ou relativa: hoje/ontem/anteontem/dia N)" },
        valorPago: {
          type: "string",
          description:
            "Valor pago AGORA, em reais — se menor que o total, o resto vira débito do cliente. Se o usuário disser que ficou fiado / em débito / para pagar depois, mande \"0,00\". Se ele disser que pagou parte, mande a parte paga.",
        },
        observacoes: {
          type: "string",
          description:
            "Anotação livre da venda. Use para o que não tem campo próprio — por exemplo uma data prevista de pagamento (\"pagamento previsto para 05/09\"), combinado de entrega ou qualquer detalhe do acordo.",
        },
      },
      required: ["itens"],
    },
    handler: async (args) => {
      const itensArgs = Array.isArray(args.itens) ? (args.itens as Array<Record<string, unknown>>) : [];
      if (itensArgs.length === 0) {
        return {
          success: false,
          error_code: "ITENS_OBRIGATORIOS",
          message: "Para registrar a venda e baixar o estoque corretamente, preciso saber quais produtos foram vendidos.",
        };
      }

      const formaPagamentoInformada = texto(args.formaPagamento) as FormaPagamento | undefined;
      const formaPagamento: FormaPagamento = formaPagamentoInformada ?? "PIX";

      const itensResolvidos: Array<{ produtoId: string; quantidade: number; descontoItem: number; precoUnitario: number }> = [];
      const itensExibicao: Array<{ produto: string; quantidade: number; precoUnitario: string; subtotal: string }> = [];
      const avisosHomonimos: string[] = [];
      const avisosPreco: string[] = [];
      let subtotal = 0;

      for (const itemArg of itensArgs) {
        const produtoId = texto(itemArg.produtoId);
        // Quantidade não informada = 1. "Vendi um X" e "Vendi X" são a
        // mesma coisa, e perguntar isso trava o usuário no meio do atendimento
        // — a prévia mostra a quantidade, então um engano aparece antes de gravar.
        const quantidade = numero(itemArg.quantidade) ?? 1;
        if (!produtoId || quantidade <= 0) {
          return { success: false, error_code: "ITEM_INVALIDO", message: "Um dos itens está sem produto ou com quantidade inválida." };
        }
        const produto = await buscarProdutoPorId(produtoId);
        if (!produto) {
          return { success: false, error_code: "PRODUTO_NAO_ENCONTRADO", message: "Um dos produtos informados não foi encontrado." };
        }
        if (!produto.ativo) {
          return { success: false, error_code: "PRODUTO_ARQUIVADO", message: `"${produto.nome}" está arquivado e não pode ser vendido.` };
        }
        const estoqueAtual = await estoqueTotalProduto(produtoId);
        if (estoqueAtual < quantidade) {
          return {
            success: false,
            error_code: "ESTOQUE_INSUFICIENTE",
            message: `"${produto.nome}" tem apenas ${estoqueAtual} unidade(s) em estoque (pedido: ${quantidade}).`,
          };
        }
        const descontoItem = paraCentavos(itemArg.descontoItem) ?? 0;
        // Preço combinado com o cliente vence o do cadastro. Quem faz essa
        // conta é aqui, nunca o modelo — foi exatamente onde ele já errou,
        // somando preço de tabela com preço negociado no meio do texto.
        const precoInformado = paraCentavos(itemArg.precoUnitario);
        const precoUnitario = precoInformado ?? produto.precoVenda;
        if (precoUnitario < 0) {
          return { success: false, error_code: "PRECO_INVALIDO", message: `Preço inválido informado para "${produto.nome}".` };
        }
        const subtotalItem = precoUnitario * quantidade - descontoItem;
        if (subtotalItem < 0) {
          return {
            success: false,
            error_code: "DESCONTO_MAIOR_QUE_ITEM",
            message: `O desconto informado para "${produto.nome}" é maior que o valor do item.`,
          };
        }
        subtotal += subtotalItem;
        itensResolvidos.push({ produtoId, quantidade, descontoItem, precoUnitario });
        itensExibicao.push({
          // categoria, tamanho e marca vão junto de propósito: existem produtos
          // de mesmo nome que só se distinguem por isso, com preços bem
          // diferentes. Sem eles o usuário confirmaria sem notar a troca.
          produto: `${produto.nome} — ${produto.categoria}${produto.medida ? ` ${produto.medida}ml` : ""} (${produto.marca})`,
          quantidade,
          precoUnitario: centavosParaReais(precoUnitario),
          subtotal: centavosParaReais(subtotalItem),
        });

        // Preço fora do cadastro é normal (negociação), mas precisa ficar
        // explícito na confirmação para o dono notar um engano de digitação.
        if (precoInformado !== undefined && precoInformado !== produto.precoVenda) {
          const diferenca = precoInformado - produto.precoVenda;
          avisosPreco.push(
            `"${produto.nome}" saiu por ${centavosParaReais(precoInformado)} — ` +
              `${diferenca > 0 ? "acima" : "abaixo"} do cadastro (${centavosParaReais(produto.precoVenda)}), ` +
              `diferença de ${centavosParaReais(Math.abs(diferenca))} por unidade.`
          );
        }

        // Homônimos: se existe outro produto ativo com o MESMO nome, avisa na
        // prévia em vez de gastar um turno perguntando. O usuário vê a marca
        // escolhida e a alternativa, e corrige na hora de confirmar.
        const homonimos = await prisma.$queryRaw<
          Array<{ nome: string; marca: string; categoria: string; medida: number | null; precoVenda: number }>
        >`
          SELECT nome, marca, categoria, "medida", "precoVenda" FROM "Produto"
          WHERE ativo = true AND id <> ${produtoId}
            AND unaccent(lower(nome)) = unaccent(lower(${produto.nome}))
          LIMIT 3
        `;
        if (homonimos.length > 0) {
          const escolhido = `${produto.categoria}${produto.medida ? ` ${produto.medida}ml` : ""} da ${produto.marca}`;
          avisosHomonimos.push(
            `Existe outro "${produto.nome}": ${homonimos
              .map((h) => `${h.categoria}${h.medida ? ` ${h.medida}ml` : ""} da ${h.marca} (${centavosParaReais(h.precoVenda)})`)
              .join(", ")}. Estou usando o ${escolhido} — avise se era o outro.`
          );
        }
      }

      let clienteId = texto(args.clienteId) ?? null;
      let clienteNomeExibicao: string | null = null;
      let novoClienteResolvido: { nome: string; telefone: string | null; email: string | null } | null = null;

      if (clienteId) {
        const cliente = await buscarClientePorId(clienteId);
        if (!cliente) return { success: false, error_code: "CLIENTE_NAO_ENCONTRADO", message: "Cliente não encontrado." };
        if (!cliente.ativo) return { success: false, error_code: "CLIENTE_ARQUIVADO", message: `Cliente "${cliente.nome}" está arquivado.` };
        clienteNomeExibicao = cliente.nome;
      } else if (args.novoCliente && typeof args.novoCliente === "object") {
        const nomeNovo = texto((args.novoCliente as Record<string, unknown>).nome);
        if (!nomeNovo) {
          return { success: false, error_code: "NOME_CLIENTE_OBRIGATORIO", message: "Preciso do nome do novo cliente para continuar." };
        }
        novoClienteResolvido = {
          nome: nomeNovo,
          telefone: texto((args.novoCliente as Record<string, unknown>).telefone) ?? null,
          email: texto((args.novoCliente as Record<string, unknown>).email) ?? null,
        };
        clienteNomeExibicao = `${nomeNovo} (cliente novo)`;
        clienteId = null;
      }

      const descontoTotal = paraCentavos(args.descontoTotal) ?? 0;
      const acrescimoTotal = paraCentavos(args.acrescimoTotal) ?? 0;
      const total = subtotal - descontoTotal + acrescimoTotal;
      if (total < 0) {
        return { success: false, error_code: "TOTAL_INVALIDO", message: "O desconto informado é maior que o total da venda." };
      }
      const valorPago = args.valorPago !== undefined ? paraCentavos(args.valorPago) ?? total : total;
      if (valorPago < 0 || valorPago > total) {
        return { success: false, error_code: "VALOR_PAGO_INVALIDO", message: "O valor pago não pode ser negativo nem maior que o total da venda." };
      }

      const dataVenda = paraData(args.dataVenda);
      const hoje = new Date();
      const backdated = dataVenda ? dataVenda.toDateString() !== hoje.toDateString() && dataVenda < hoje : false;

      const observacoes = texto(args.observacoes) ?? null;

      const warnings: string[] = [...avisosPreco, ...avisosHomonimos];
      if (!formaPagamentoInformada) warnings.push("Forma de pagamento não informada — assumindo PIX (padrão). Avise se foi outra forma.");
      if (backdated) warnings.push(`Data retroativa: ${dataVenda!.toLocaleDateString("pt-BR")}.`);
      if (valorPago < total) warnings.push(`Fica em aberto: ${centavosParaReais(total - valorPago)}${clienteNomeExibicao ? ` para ${clienteNomeExibicao}` : " — informe um cliente para controlar o débito"}.`);

      return {
        success: true,
        data: {
          itens: itensExibicao,
          cliente: clienteNomeExibicao ?? "não informado (venda avulsa)",
          formaPagamento,
          subtotal: centavosParaReais(subtotal),
          descontoTotal: centavosParaReais(descontoTotal),
          acrescimoTotal: centavosParaReais(acrescimoTotal),
          total: centavosParaReais(total),
          valorPago: centavosParaReais(valorPago),
          emAberto: centavosParaReais(total - valorPago),
          observacoes: observacoes ?? "nenhuma",
          data: dataVenda ? dataVenda.toLocaleDateString("pt-BR") : "hoje",
          resolvido: {
            itens: itensResolvidos,
            clienteId,
            novoCliente: novoClienteResolvido,
            formaPagamento,
            descontoTotal,
            acrescimoTotal,
            valorPago,
            observacoes,
            dataVenda: dataVenda ? dataVenda.toISOString() : null,
          },
        },
        warnings: warnings.length > 0 ? warnings : undefined,
        message: `Confira a venda antes de registrar: ${itensExibicao.length} item(ns), total ${centavosParaReais(total)}, pagamento ${formaPagamento}. Confirma o registro?`,
      };
    },
  },
  {
    nome: "create_stock_entry_preview",
    descricao:
      "Monta a prévia de uma entrada de estoque para confirmação (Nível 2). Identifique cada item pelo SKU (mais seguro) ou pelo produtoId. NUNCA monte a lista pareando posições de duas listas diferentes: cada item leva o SEU produto junto do SEU custo.",
    recurso: "estoque",
    nivel: 2,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sku: { type: "string", description: "SKU do produto. Prefira este campo: é único e evita trocar um produto pelo outro." },
              produtoId: { type: "string", description: "Alternativa ao sku, se você já tem o id resolvido." },
              nome: { type: "string", description: "Alternativa ao sku: o nome do produto como aparece no pedido (ex: 'Attar Al Wesal'). Use junto de marca e medida para não haver dúvida. A ferramenta resolve o produto e avisa se ficar ambíguo." },
              marca: { type: "string", description: "Marca, quando identificar o produto por nome." },
              medida: { type: "number", description: `${rotuloMedida()}, quando identificar o produto por nome. Essencial para separar variações de tamanho do mesmo produto.` },
              quantidade: { type: "number" },
              custoUnitario: { type: "string", description: "Custo unitário em reais, ex: '170,00'" },
            },
            required: ["quantidade", "custoUnitario"],
          },
        },
        valorFrete: { type: "string", description: "Frete total da entrada, em reais" },
        fornecedorId: { type: "string" },
        dataEntrada: { type: "string", description: "Data da entrada (ISO ou relativa)" },
        observacoes: { type: "string" },
      },
      required: ["itens"],
    },
    handler: async (args) => {
      const itensArgs = Array.isArray(args.itens) ? (args.itens as Array<Record<string, unknown>>) : [];
      if (itensArgs.length === 0) {
        return { success: false, error_code: "ITENS_OBRIGATORIOS", message: "Preciso de ao menos um produto para dar entrada no estoque." };
      }

      const itensResolvidos: Array<{ produtoId: string; quantidade: number; custoUnitario: number }> = [];
      const nomesPorId = new Map<string, string>();

      for (const itemArg of itensArgs) {
        const quantidade = numero(itemArg.quantidade);
        const custoUnitario = paraCentavos(itemArg.custoUnitario);
        const sku = texto(itemArg.sku);
        const idInformado = texto(itemArg.produtoId);

        if (!quantidade || quantidade <= 0 || !custoUnitario || custoUnitario <= 0) {
          return { success: false, error_code: "ITEM_INVALIDO", message: "Um dos itens está com quantidade ou custo inválido." };
        }
        const nomeInformado = texto(itemArg.nome);
        if (!sku && !idInformado && !nomeInformado) {
          return { success: false, error_code: "PRODUTO_NAO_IDENTIFICADO", message: "Cada item precisa do SKU, do produtoId ou do nome do produto." };
        }

        // Cada linha carrega o próprio produto junto do próprio custo. Antes só
        // existia produtoId, e o modelo chegou a montar a lista pareando a ordem
        // de duas listas diferentes — o custo de um produto ia parar no lote de
        // outro. Aceitar SKU e nome permite transcrever o pedido linha a linha.
        let produto = sku
          ? await buscarProdutoPorSku(sku)
          : idInformado
            ? await buscarProdutoPorId(idInformado)
            : null;

        if (!produto && nomeInformado) {
          const marcaItem = texto(itemArg.marca);
          const tamanhoItem = numero(itemArg.medida) ?? null;
          const encontrados = (await buscarProdutosParaVenda({ termo: [nomeInformado, marcaItem].filter(Boolean).join(" ") }))
            .filter((c) => tamanhoItem === null || c.medida === tamanhoItem);

          // Nome exato ganha de nome parcial: pedir "X" havendo "X" e
          // "X Plus" cadastrados não é ambiguidade de verdade, e perguntar
          // ali custa um turno inteiro do lançamento.
          const semAcento = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
          const exatos = encontrados.filter((c) => semAcento(c.nome) === semAcento(nomeInformado));
          const candidatos = exatos.length === 1 ? exatos : encontrados;

          if (candidatos.length > 1) {
            return {
              success: false,
              error_code: "PRODUTO_AMBIGUO",
              message:
                `"${nomeInformado}" corresponde a mais de um produto: ` +
                candidatos.map((c) => `${c.nome} — ${c.categoria}${c.medida ? ` ${c.medida}ml` : ""} (${c.marca}), SKU ${c.sku}`).join("; ") +
                ". Informe o SKU do que entrou.",
            };
          }
          if (candidatos.length === 1) produto = await buscarProdutoPorId(candidatos[0].id);
        }

        if (!produto) {
          const referencia = sku ? `de SKU "${sku}"` : nomeInformado ? `"${nomeInformado}"` : "informado";
          return {
            success: false,
            error_code: "PRODUTO_NAO_ENCONTRADO",
            message: `Não encontrei o produto ${referencia}. Cadastre-o antes de dar entrada no estoque.`,
          };
        }
        nomesPorId.set(produto.id, `${produto.nome} — ${produto.categoria}${produto.medida ? ` ${produto.medida}ml` : ""} (${produto.marca})`);
        itensResolvidos.push({ produtoId: produto.id, quantidade, custoUnitario });
      }

      let fornecedorNome: string | null = null;
      const fornecedorId = texto(args.fornecedorId) ?? null;
      if (fornecedorId) {
        const fornecedor = await buscarFornecedorPorId(fornecedorId);
        if (!fornecedor) return { success: false, error_code: "FORNECEDOR_NAO_ENCONTRADO", message: "Fornecedor não encontrado." };
        fornecedorNome = fornecedor.nome;
      }

      const valorFrete = paraCentavos(args.valorFrete) ?? 0;
      const freteRateado = ratearFreteUniforme(itensResolvidos, valorFrete);
      const dataEntrada = paraData(args.dataEntrada);
      const observacoes = texto(args.observacoes) ?? null;

      const itensExibicao = itensResolvidos.map((item) => ({
        produto: nomesPorId.get(item.produtoId) ?? item.produtoId,
        quantidade: item.quantidade,
        custoUnitario: centavosParaReais(item.custoUnitario),
        freteRateado: centavosParaReais(freteRateado),
        custoReal: centavosParaReais(item.custoUnitario + freteRateado),
      }));
      const totalEntrada = itensResolvidos.reduce((soma, item) => soma + (item.custoUnitario + freteRateado) * item.quantidade, 0);

      return {
        success: true,
        data: {
          itens: itensExibicao,
          fornecedor: fornecedorNome ?? "não informado",
          valorFrete: centavosParaReais(valorFrete),
          data: dataEntrada ? dataEntrada.toLocaleDateString("pt-BR") : "hoje",
          totalEntrada: centavosParaReais(totalEntrada),
          resolvido: {
            itens: itensResolvidos,
            valorFrete,
            fornecedorId,
            dataEntrada: dataEntrada ? dataEntrada.toISOString() : null,
            observacoes,
          },
        },
        message: `Confira a entrada de estoque: ${itensExibicao.length} produto(s), frete de ${centavosParaReais(valorFrete)}, custo total ${centavosParaReais(totalEntrada)}. Confirma?`,
      };
    },
  },
  {
    nome: "create_expense_preview",
    descricao:
      "Monta a prévia de uma despesa para confirmação (Nível 2). Se a categoria informada não existir, a ferramenta devolve as categorias existentes em vez de criar uma nova sozinha.",
    recurso: "despesas",
    nivel: 2,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        descricao: { type: "string" },
        categoriaNome: { type: "string", description: "Nome de uma categoria já existente" },
        valor: { type: "string", description: "Valor em reais, ex: '99,00'" },
        dataDespesa: { type: "string", description: "Data de competência (ISO ou relativa)" },
        vencimento: { type: "string" },
        classificacao: {
          type: "string",
          enum: ["FIXA", "VARIAVEL", "ADMINISTRATIVA", "COMERCIAL", "OPERACIONAL", "MARKETING", "EXCEPCIONAL"],
        },
        formaPagamento: { type: "string", enum: ["DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO", "BOLETO", "TRANSFERENCIA", "OUTRO"] },
        jaPaga: { type: "boolean", description: "true se o usuário disse que a despesa já foi paga" },
        recorrencia: { type: "string", enum: ["NENHUMA", "SEMANAL", "MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"] },
      },
      required: ["descricao", "categoriaNome", "valor", "classificacao"],
    },
    handler: async (args) => {
      const descricao = texto(args.descricao);
      const categoriaNome = texto(args.categoriaNome);
      const valor = paraCentavos(args.valor);
      const classificacao = texto(args.classificacao) as ClassificacaoDespesa | undefined;

      if (!descricao || !valor || valor <= 0 || !classificacao) {
        return { success: false, error_code: "DADOS_INCOMPLETOS", message: "Preciso da descrição, valor e classificação da despesa." };
      }
      if (!categoriaNome) {
        return { success: false, error_code: "CATEGORIA_OBRIGATORIA", message: "Qual categoria devo usar para essa despesa?" };
      }

      const categorias = await listarCategoriasDespesa();
      const categoria = categorias.find((c) => c.nome.toLowerCase() === categoriaNome.toLowerCase());
      if (!categoria) {
        return {
          success: false,
          error_code: "CATEGORIA_NAO_ENCONTRADA",
          message: `Não encontrei a categoria "${categoriaNome}". Categorias existentes: ${categorias.map((c) => c.nome).join(", ") || "nenhuma cadastrada"}.`,
          details: { categoriasExistentes: categorias.map((c) => c.nome) },
        };
      }

      const dataDespesa = paraData(args.dataDespesa) ?? new Date();
      const vencimento = paraData(args.vencimento);
      const formaPagamento = texto(args.formaPagamento) as FormaPagamentoDespesa | undefined;
      const jaPaga = args.jaPaga === true;
      const recorrencia = (texto(args.recorrencia) as TipoRecorrencia | undefined) ?? "NENHUMA";

      if (jaPaga && !formaPagamento) {
        return { success: false, error_code: "FORMA_PAGAMENTO_OBRIGATORIA", message: "Como essa despesa foi paga? (dinheiro, PIX, boleto, cartão...)" };
      }

      return {
        success: true,
        data: {
          descricao,
          categoria: categoria.nome,
          valor: centavosParaReais(valor),
          dataDespesa: dataDespesa.toLocaleDateString("pt-BR"),
          vencimento: vencimento ? vencimento.toLocaleDateString("pt-BR") : "sem vencimento",
          classificacao,
          status: jaPaga ? "já paga" : "pendente",
          recorrencia: recorrencia === "NENHUMA" ? "não recorrente" : recorrencia,
          resolvido: {
            descricao,
            categoriaId: categoria.id,
            valor,
            dataDespesa: dataDespesa.toISOString(),
            vencimento: vencimento ? vencimento.toISOString() : null,
            classificacao,
            formaPagamento: formaPagamento ?? null,
            jaPaga,
            recorrencia,
          },
        },
        message: `Confira a despesa: "${descricao}", ${centavosParaReais(valor)}, categoria ${categoria.nome}${jaPaga ? ", já paga" : ""}. Confirma o lançamento?`,
      };
    },
  },
  {
    nome: "cancel_sale_preview",
    descricao:
      "Monta a prévia do cancelamento de uma venda para confirmação reforçada (Nível 3 — ação crítica, não pode ser desfeita). Use get_sale ou search_sales antes para achar o vendaId certo.",
    recurso: "vendas",
    nivel: 3,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        vendaId: { type: "string" },
        motivo: { type: "string" },
      },
      required: ["vendaId", "motivo"],
    },
    handler: async (args) => {
      const vendaId = texto(args.vendaId);
      const motivo = texto(args.motivo);
      if (!vendaId) return { success: false, error_code: "VENDA_OBRIGATORIA", message: "Qual venda você quer cancelar?" };
      if (!motivo) return { success: false, error_code: "MOTIVO_OBRIGATORIO", message: "Preciso saber o motivo do cancelamento." };

      const venda = await buscarVendaPorId(vendaId);
      if (!venda) return { success: false, error_code: "VENDA_NAO_ENCONTRADA", message: "Venda não encontrada." };
      if (venda.status === "CANCELADA") {
        return { success: false, error_code: "JA_CANCELADA", message: "Essa venda já está cancelada." };
      }

      const itensExibicao = venda.itens.map((item) => `${item.quantidade}x ${item.produto.nome}`);

      return {
        success: true,
        data: {
          vendaId: venda.id,
          cliente: venda.cliente?.nome ?? "não informado",
          total: centavosParaReais(venda.total),
          itens: itensExibicao,
          motivo,
          resolvido: { vendaId, motivo },
        },
        warnings: ["Essa ação não pode ser desfeita.", `${itensExibicao.length} produto(s) voltarão ao estoque.`],
        message: `Confirma o cancelamento da venda nº ${venda.id.slice(-6)} (${venda.cliente?.nome ?? "sem cliente"}, total ${centavosParaReais(venda.total)}, ${itensExibicao.join(", ")})? Os itens voltam ao estoque e a ação não pode ser desfeita. Motivo: ${motivo}.`,
      };
    },
  },
  {
    nome: "create_return_preview",
    descricao:
      "Monta a prévia de uma devolução (parcial ou total) para confirmação reforçada (Nível 3). Use get_sale antes para saber os itemVendaId disponíveis.",
    recurso: "vendas",
    nivel: 3,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        vendaId: { type: "string" },
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemVendaId: { type: "string" },
              quantidade: { type: "number" },
              retornaEstoque: { type: "boolean", description: "true se o produto devolvido volta pro estoque vendável" },
            },
            required: ["itemVendaId", "quantidade"],
          },
        },
        motivo: { type: "string" },
      },
      required: ["vendaId", "itens", "motivo"],
    },
    handler: async (args) => {
      const vendaId = texto(args.vendaId);
      const motivo = texto(args.motivo);
      const itensArgs = Array.isArray(args.itens) ? (args.itens as Array<Record<string, unknown>>) : [];

      if (!vendaId) return { success: false, error_code: "VENDA_OBRIGATORIA", message: "Qual venda teve o item devolvido?" };
      if (!motivo) return { success: false, error_code: "MOTIVO_OBRIGATORIO", message: "Preciso saber o motivo da devolução." };
      if (itensArgs.length === 0) {
        return { success: false, error_code: "ITENS_OBRIGATORIOS", message: "Qual item foi devolvido, e quantas unidades?" };
      }

      const venda = await buscarVendaPorId(vendaId);
      if (!venda) return { success: false, error_code: "VENDA_NAO_ENCONTRADA", message: "Venda não encontrada." };
      if (venda.status === "CANCELADA") {
        return { success: false, error_code: "VENDA_CANCELADA", message: "Uma venda cancelada não pode receber devolução." };
      }

      const itensResolvidos: Array<{ itemVendaId: string; quantidade: number; retornaEstoque: boolean }> = [];
      const itensExibicao: string[] = [];

      for (const itemArg of itensArgs) {
        const itemVendaId = texto(itemArg.itemVendaId);
        const quantidade = numero(itemArg.quantidade);
        if (!itemVendaId || !quantidade || quantidade <= 0) {
          return { success: false, error_code: "ITEM_INVALIDO", message: "Um dos itens de devolução está sem quantidade válida." };
        }
        const itemVenda = venda.itens.find((item) => item.id === itemVendaId);
        if (!itemVenda) {
          return { success: false, error_code: "ITEM_NAO_ENCONTRADO", message: "Um dos itens informados não pertence a essa venda." };
        }
        const jaDevolvido = itemVenda.itensDevolvidos.reduce((soma, d) => soma + d.quantidade, 0);
        const disponivel = itemVenda.quantidade - jaDevolvido;
        if (quantidade > disponivel) {
          return {
            success: false,
            error_code: "QUANTIDADE_INVALIDA",
            message: `"${itemVenda.produto.nome}" só tem ${disponivel} unidade(s) disponível(is) para devolução.`,
          };
        }
        const retornaEstoque = itemArg.retornaEstoque !== false;
        itensResolvidos.push({ itemVendaId, quantidade, retornaEstoque });
        itensExibicao.push(`${quantidade}x ${itemVenda.produto.nome}${retornaEstoque ? " (volta ao estoque)" : " (não volta ao estoque)"}`);
      }

      return {
        success: true,
        data: {
          vendaId: venda.id,
          itens: itensExibicao,
          motivo,
          resolvido: { vendaId, motivo, itens: itensResolvidos },
        },
        warnings: ["Essa ação não pode ser desfeita."],
        message: `Confirma a devolução da venda nº ${venda.id.slice(-6)}: ${itensExibicao.join(", ")}. Motivo: ${motivo}.`,
      };
    },
  },
  {
    nome: "create_stock_adjustment_preview",
    descricao:
      "Monta a prévia de um ajuste de estoque (positivo, negativo, perda por vencimento/defeito, ou baixa por brinde) para confirmação reforçada (Nível 3). Use search_products antes para achar o produtoId.",
    recurso: "estoque",
    nivel: 3,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        produtoId: { type: "string" },
        pool: { type: "string", enum: ["VENDA", "DEMONSTRACAO"], description: "VENDA = estoque normal, DEMONSTRACAO = pool de demonstracao" },
        tipo: { type: "string", enum: TIPOS_AJUSTE },
        quantidade: { type: "number" },
        motivo: { type: "string" },
      },
      required: ["produtoId", "tipo", "quantidade", "motivo"],
    },
    handler: async (args) => {
      const produtoId = texto(args.produtoId);
      const tipo = texto(args.tipo) as TipoAjuste | undefined;
      const quantidade = numero(args.quantidade);
      const motivo = texto(args.motivo);
      const pool = (texto(args.pool) as "VENDA" | "DEMONSTRACAO" | undefined) ?? "VENDA";

      if (!produtoId || !tipo || !quantidade || quantidade <= 0) {
        return { success: false, error_code: "DADOS_INVALIDOS", message: "Preciso do produto, tipo de ajuste e quantidade." };
      }
      if (!motivo) return { success: false, error_code: "MOTIVO_OBRIGATORIO", message: "Preciso saber o motivo do ajuste." };

      const produto = await buscarProdutoPorId(produtoId);
      if (!produto) return { success: false, error_code: "PRODUTO_NAO_ENCONTRADO", message: "Produto não encontrado." };

      const agregado = await prisma.lote.aggregate({
        where: { produtoId, status: "ATIVO" },
        _sum: { quantidadeAtualVenda: true, quantidadeAtualDemonstracao: true },
      });
      const saldoAtual = pool === "VENDA" ? agregado._sum.quantidadeAtualVenda ?? 0 : agregado._sum.quantidadeAtualDemonstracao ?? 0;

      if (tipo !== "AJUSTE_POSITIVO" && quantidade > saldoAtual) {
        return {
          success: false,
          error_code: "ESTOQUE_INSUFICIENTE",
          message: `"${produto.nome}" tem apenas ${saldoAtual} unidade(s) no pool ${pool === "VENDA" ? "de venda" : "de demonstracao"} — não é possível baixar ${quantidade}.`,
        };
      }

      return {
        success: true,
        data: {
          produto: produto.nome,
          tipo: LABEL_TIPO_AJUSTE[tipo],
          quantidade,
          pool: pool === "VENDA" ? "estoque de venda" : "demonstracao",
          saldoAntes: saldoAtual,
          saldoDepois: tipo === "AJUSTE_POSITIVO" ? saldoAtual + quantidade : saldoAtual - quantidade,
          motivo,
          resolvido: { produtoId, pool, tipo, quantidade, motivo },
        },
        warnings: tipo !== "AJUSTE_POSITIVO" ? ["Essa ação não pode ser desfeita."] : undefined,
        message: `Confirma o ${LABEL_TIPO_AJUSTE[tipo]} de ${quantidade} unidade(s) de "${produto.nome}" (${pool === "VENDA" ? "estoque de venda" : "demonstracao"})? Motivo: ${motivo}.`,
      };
    },
  },
  {
    nome: "update_product_price_preview",
    descricao: "Monta a prévia de uma alteração de preço de venda de um produto para confirmação reforçada (Nível 3).",
    recurso: "produtos",
    nivel: 3,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        produtoId: { type: "string" },
        precoVenda: { type: "string", description: "Novo preço de venda em reais, ex: '219,90'" },
      },
      required: ["produtoId", "precoVenda"],
    },
    handler: async (args) => {
      const produtoId = texto(args.produtoId);
      const precoNovo = paraCentavos(args.precoVenda);
      if (!produtoId) return { success: false, error_code: "PRODUTO_OBRIGATORIO", message: "Qual produto você quer alterar o preço?" };
      if (!precoNovo || precoNovo <= 0) return { success: false, error_code: "PRECO_INVALIDO", message: "Informe o novo preço de venda." };

      const produto = await buscarProdutoPorId(produtoId);
      if (!produto) return { success: false, error_code: "PRODUTO_NAO_ENCONTRADO", message: "Produto não encontrado." };

      return {
        success: true,
        data: {
          produto: produto.nome,
          precoAtual: centavosParaReais(produto.precoVenda),
          precoNovo: centavosParaReais(precoNovo),
          resolvido: { produtoId, precoVenda: precoNovo },
        },
        message: `Confirma alterar o preço de "${produto.nome}" de ${centavosParaReais(produto.precoVenda)} para ${centavosParaReais(precoNovo)}?`,
      };
    },
  },
  {
    nome: "create_product_preview",
    descricao:
      "Monta a prévia do cadastro de UM OU VÁRIOS produtos novos para confirmação (Nível 2). Use quando o usuário pedir para cadastrar produto(s) — inclusive quando ele manda uma lista de compra e pede 'cadastre os que não tem'. Passe TODOS os produtos de uma vez no array. A ferramenta já detecta quais deles JÁ EXISTEM e cadastra só os que faltam, gera o SKU automaticamente e avisa se a categoria é nova. ATENÇÃO: a marca é atributo do produto, NUNCA o fornecedor.",
    recurso: "produtos",
    nivel: 2,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        produtos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nome: { type: "string", description: "Nome do produto, sem a marca." },
              marca: { type: "string", description: `Marca/fabricante do produto (campo "${nicho.termos.marca}"). NÃO é o fornecedor.` },
              categoria: { type: "string", description: `Tipo do produto${categoriasSugeridas()}.` },
              medida: { type: "number", description: `${rotuloMedida()}. SEMPRE informe quando souber — é o que distingue variações do mesmo produto, e sem isso a ferramenta não consegue confirmar se ele já existe.` },
              precoVenda: { type: "string", description: "Preço de VENDA ao cliente, em reais. Obrigatório — se o usuário não disser, PERGUNTE antes de chamar esta ferramenta. Nunca use o custo de compra aqui." },
              precoCustoRef: { type: "string", description: "Custo pago ao fornecedor, em reais. PREENCHA SEMPRE que o usuário disser quanto pagou — numa lista de pedido de compra, o valor ao lado do produto é o CUSTO, nunca o preço de venda." },
              atributoB: { type: "string", enum: ["MASCULINO", "FEMININO", "UNISSEX"] },
              sku: { type: "string", description: "Só informe se o usuário ditar um SKU específico. Caso contrário é gerado automaticamente." },
            },
            required: ["nome", "marca", "categoria", "precoVenda"],
          },
        },
      },
      required: ["produtos"],
    },
    handler: async (args) => {
      const lista = Array.isArray(args.produtos) ? (args.produtos as Array<Record<string, unknown>>) : [];
      if (lista.length === 0) {
        return { success: false, error_code: "PRODUTOS_OBRIGATORIOS", message: "Quais produtos devo cadastrar?" };
      }

      // Preço de venda é decisão do dono. Numa lista de pedido de compra os
      // valores são CUSTO, e usá-los como preço de venda cadastra o produto com
      // margem zero. As duas checagens ficam juntas e numa passada só: o dono
      // responde UMA pergunta com todos os produtos, não uma por item.
      // Só valida preço do que REALMENTE vai ser cadastrado: quem já existe no
      // catálogo já tem preço, e perguntar por ele faria o dono redigitar preço
      // de produto que ele nem pediu para cadastrar.
      const problemasDePreco: string[] = [];
      const jaCadastrados = new Set<string>();
      for (const p of lista) {
        const nomeP = texto(p.nome) ?? "?";
        const marcaP = texto(p.marca) ?? "?";
        const tamanhoP = numero(p.medida) ?? null;

        const equivalente = await procurarProdutoEquivalente(nomeP, marcaP, tamanhoP);
        if (equivalente.tipo !== "nenhum") {
          jaCadastrados.add(`${nomeP}|${marcaP}|${tamanhoP ?? ""}`.toLowerCase());
          continue;
        }

        const pv = paraCentavos(p.precoVenda) ?? 0;
        const pc = paraCentavos(p.precoCustoRef) ?? 0;
        if (pv <= 0) {
          problemasDePreco.push(`${nomeP} (${marcaP})${tamanhoP ? ` ${tamanhoP}ml` : ""} — sem preço de venda`);
        } else if (pc > 0 && pv <= pc) {
          problemasDePreco.push(
            `${nomeP} (${marcaP})${tamanhoP ? ` ${tamanhoP}ml` : ""} — veio ${centavosParaReais(pv)}, que é o próprio custo`
          );
        }
      }
      if (problemasDePreco.length > 0) {
        return {
          success: false,
          error_code: "PRECO_VENDA_OBRIGATORIO",
          message: [
            "Os valores de uma lista de pedido são o CUSTO de compra, não o preço de venda — preciso saber por quanto estes produtos vão ser VENDIDOS ao cliente:",
            ...problemasDePreco.map((p) => `- ${p}`),
            "",
            "Me passe os preços de venda (pode ser tudo de uma vez).",
          ].join("\n"),
        };
      }

      const categoriasNoCatalogo = new Set(
        (await prisma.produto.findMany({ select: { categoria: true }, distinct: ["categoria"] })).map((c) =>
          c.categoria.toLowerCase()
        )
      );

      const resolvidos: Array<Record<string, unknown>> = [];
      const exibicao: Array<Record<string, unknown>> = [];
      const jaExistem: string[] = [];
      const semCusto: string[] = [];
      const categoriasNovas = new Set<string>();
      const skusDaLeva = new Set<string>();

      for (const item of lista) {
        const nome = texto(item.nome);
        const marca = texto(item.marca);
        const categoria = texto(item.categoria);
        if (!nome || !marca || !categoria) {
          return { success: false, error_code: "DADOS_INCOMPLETOS", message: "Cada produto precisa de nome, marca e categoria." };
        }
        const medida = numero(item.medida) ?? null;
        const precoVenda = paraCentavos(item.precoVenda)!;
        const precoCustoRef = paraCentavos(item.precoCustoRef) ?? 0;

        // "Cadastre os que não tem": produto já cadastrado não vira duplicata,
        // só entra no aviso.
        const equivalente = await procurarProdutoEquivalente(nome, marca, medida);
        if (equivalente.tipo === "ambiguo") {
          return {
            success: false,
            error_code: "TAMANHO_NECESSARIO",
            message:
              `Já existe "${nome}" da ${marca} em mais de um tamanho: ` +
              equivalente.candidatos
                .map((c) => `${c.categoria}${c.medida ? ` ${c.medida}ml` : " (sem tamanho)"} — SKU ${c.sku}`)
                .join("; ") +
              ". Qual o tamanho do que você quer cadastrar? Se for um desses, ele já está cadastrado e não precisa criar de novo.",
          };
        }
        if (equivalente.tipo === "existe") {
          const p = equivalente.produto;
          jaExistem.push(`${p.nome} — ${p.categoria}${p.medida ? ` ${p.medida}ml` : ""} (${p.marca}) · SKU ${p.sku}`);
          continue;
        }

        if (!categoriasNoCatalogo.has(categoria.toLowerCase())) categoriasNovas.add(categoria);

        const sku = texto(item.sku) ?? (await gerarSkuUnico(marca, nome, medida, skusDaLeva));
        skusDaLeva.add(sku);

        resolvidos.push({
          nome,
          marca,
          categoria,
          medida,
          sku,
          codigoBarras: null,
          precoCustoRef,
          precoVenda,
          fornecedorId: null,
          atributoA: null,
          atributoB: (texto(item.atributoB) as string | undefined) ?? "UNISSEX",
          tipoVenda: "UNIDADE",
          estoqueMinimo: 0,
        });
        exibicao.push({
          produto: `${nome} — ${categoria}${medida ? ` ${medida}ml` : ""} (${marca})`,
          sku,
          precoVenda: centavosParaReais(precoVenda),
          precoCustoRef: precoCustoRef > 0 ? centavosParaReais(precoCustoRef) : "não informado",
          margem:
            precoCustoRef > 0
              ? `${centavosParaReais(precoVenda - precoCustoRef)} (${Math.round(((precoVenda - precoCustoRef) / precoCustoRef) * 100)}%)`
              : "custo não informado",
        });
        if (precoCustoRef === 0) semCusto.push(nome);
      }

      if (resolvidos.length === 0) {
        return {
          success: false,
          error_code: "NADA_A_CADASTRAR",
          message: `Nenhum produto novo para cadastrar — todos já existem: ${jaExistem.join("; ")}.`,
        };
      }

      const warnings: string[] = [];
      if (jaExistem.length > 0) warnings.push(`Já cadastrados, serão ignorados: ${jaExistem.join("; ")}.`);
      if (categoriasNovas.size > 0) warnings.push(`Categoria nova no catálogo: ${[...categoriasNovas].join(", ")}.`);
      if (semCusto.length > 0) warnings.push(`Sem custo de compra informado: ${semCusto.join(", ")}. A margem no relatório só fica correta depois da entrada de estoque.`);
      warnings.push("Os produtos entram com estoque zero — a quantidade só sobe quando você lançar a entrada de estoque.");

      return {
        success: true,
        data: { produtos: exibicao, resolvido: { produtos: resolvidos } },
        warnings,
        message: `Confira o cadastro de ${resolvidos.length} produto(s) novo(s). Confirma?`,
      };
    },
  },
  {
    nome: "create_supplier_preview",
    descricao:
      "Monta a prévia de um novo fornecedor para confirmação (Nível 2). Nunca cria o fornecedor sozinho, só devolve a prévia.",
    recurso: "fornecedores",
    nivel: 2,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        nome: { type: "string" },
        documento: { type: "string", description: "CNPJ/CPF, se houver" },
        telefone: { type: "string" },
        email: { type: "string" },
        endereco: { type: "string" },
        observacoes: { type: "string" },
      },
      required: ["nome"],
    },
    handler: async (args) => {
      const nome = texto(args.nome);
      if (!nome) {
        return { success: false, error_code: "NOME_OBRIGATORIO", message: "Preciso do nome do fornecedor para continuar." };
      }
      const documento = texto(args.documento) ?? null;
      const telefone = texto(args.telefone) ?? null;
      const email = texto(args.email) ?? null;
      const endereco = texto(args.endereco) ?? null;
      const observacoes = texto(args.observacoes) ?? null;

      const parecidos = await listarFornecedores(nome);
      const warnings = parecidos.length > 0 ? [`Já existe fornecedor parecido: ${parecidos.map((f) => f.nome).join(", ")}.`] : undefined;

      return {
        success: true,
        data: {
          nome,
          telefone: telefone ?? "não informado",
          documento: documento ?? "não informado",
          resolvido: { nome, documento, telefone, email, endereco, observacoes },
        },
        warnings,
        message: `Confira os dados antes de cadastrar o fornecedor: ${nome}${telefone ? `, telefone ${telefone}` : ""}. Confirma o cadastro?`,
      };
    },
  },
  {
    nome: "update_supplier_preview",
    descricao:
      "Monta a prévia de uma alteração de dados de um fornecedor já existente para confirmação (Nível 2). Use search_suppliers antes para achar o fornecedorId. Só altera os campos informados — os demais continuam como estavam.",
    recurso: "fornecedores",
    nivel: 2,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        fornecedorId: { type: "string" },
        nome: { type: "string" },
        documento: { type: "string" },
        telefone: { type: "string" },
        email: { type: "string" },
        endereco: { type: "string" },
        observacoes: { type: "string" },
      },
      required: ["fornecedorId"],
    },
    handler: async (args) => {
      const fornecedorId = texto(args.fornecedorId);
      if (!fornecedorId) {
        return { success: false, error_code: "FORNECEDOR_OBRIGATORIO", message: "Qual fornecedor você quer atualizar?" };
      }
      const fornecedor = await buscarFornecedorPorId(fornecedorId);
      if (!fornecedor) {
        return { success: false, error_code: "FORNECEDOR_NAO_ENCONTRADO", message: "Fornecedor não encontrado." };
      }

      const novoNome = texto(args.nome);
      const novoDocumento = texto(args.documento);
      const novoTelefone = texto(args.telefone);
      const novoEmail = texto(args.email);
      const novoEndereco = texto(args.endereco);
      const novasObservacoes = texto(args.observacoes);

      const mudancas: string[] = [];
      if (novoNome !== undefined && novoNome !== fornecedor.nome) mudancas.push(`nome: "${fornecedor.nome}" → "${novoNome}"`);
      if (novoDocumento !== undefined && novoDocumento !== fornecedor.documento) mudancas.push(`documento: "${fornecedor.documento ?? "vazio"}" → "${novoDocumento}"`);
      if (novoTelefone !== undefined && novoTelefone !== fornecedor.telefone) mudancas.push(`telefone: "${fornecedor.telefone ?? "vazio"}" → "${novoTelefone}"`);
      if (novoEmail !== undefined && novoEmail !== fornecedor.email) mudancas.push(`email: "${fornecedor.email ?? "vazio"}" → "${novoEmail}"`);
      if (novoEndereco !== undefined && novoEndereco !== fornecedor.endereco) mudancas.push(`endereço: "${fornecedor.endereco ?? "vazio"}" → "${novoEndereco}"`);
      if (novasObservacoes !== undefined && novasObservacoes !== fornecedor.observacoes) mudancas.push(`observações: "${fornecedor.observacoes ?? "vazio"}" → "${novasObservacoes}"`);

      if (mudancas.length === 0) {
        return { success: false, error_code: "NADA_PARA_ATUALIZAR", message: "Nenhum dado novo foi informado para atualizar." };
      }

      return {
        success: true,
        data: {
          fornecedor: fornecedor.nome,
          mudancas,
          resolvido: {
            fornecedorId,
            nome: novoNome ?? fornecedor.nome,
            documento: novoDocumento ?? fornecedor.documento,
            telefone: novoTelefone ?? fornecedor.telefone,
            email: novoEmail ?? fornecedor.email,
            endereco: novoEndereco ?? fornecedor.endereco,
            observacoes: novasObservacoes ?? fornecedor.observacoes,
          },
        },
        message: `Confirma atualizar o fornecedor "${fornecedor.nome}"? ${mudancas.join("; ")}.`,
      };
    },
  },
  {
    nome: "create_purchase_order_preview",
    descricao:
      "Monta a prévia de um pedido de compra a um fornecedor para confirmação (Nível 2). Os produtos devem ser informados com o produtoId já resolvido via search_products, e o fornecedor via search_suppliers. IMPORTANTE: confirmar aqui só cria o pedido como RASCUNHO — não altera estoque. Enviar e receber o pedido (com número de lote) é feito na tela de Compras, não pelo assistente.",
    recurso: "compras",
    nivel: 2,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        fornecedorId: { type: "string" },
        itens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              produtoId: { type: "string" },
              quantidade: { type: "number" },
              quantidadeDemonstracao: { type: "number", description: "Unidades destinadas ao pool de demonstracao, se houver" },
              custoUnitario: { type: "string", description: "Custo unitário em reais, ex: '170,00'" },
            },
            required: ["produtoId", "quantidade", "custoUnitario"],
          },
        },
        valorFrete: { type: "string", description: "Frete total do pedido, em reais" },
        observacoes: { type: "string" },
      },
      required: ["fornecedorId", "itens"],
    },
    handler: async (args) => {
      const fornecedorId = texto(args.fornecedorId);
      if (!fornecedorId) {
        return { success: false, error_code: "FORNECEDOR_OBRIGATORIO", message: "Qual fornecedor é esse pedido de compra?" };
      }
      const fornecedor = await buscarFornecedorPorId(fornecedorId);
      if (!fornecedor) {
        return { success: false, error_code: "FORNECEDOR_NAO_ENCONTRADO", message: "Fornecedor não encontrado." };
      }

      const itensArgs = Array.isArray(args.itens) ? (args.itens as Array<Record<string, unknown>>) : [];
      if (itensArgs.length === 0) {
        return { success: false, error_code: "ITENS_OBRIGATORIOS", message: "Preciso de ao menos um produto para montar o pedido de compra." };
      }

      const itensResolvidos: Array<{ produtoId: string; quantidade: number; quantidadeDemonstracao: number; custoUnitario: number }> = [];
      const nomesPorId = new Map<string, string>();

      for (const itemArg of itensArgs) {
        const produtoId = texto(itemArg.produtoId);
        const quantidade = numero(itemArg.quantidade);
        const quantidadeDemonstracao = numero(itemArg.quantidadeDemonstracao) ?? 0;
        const custoUnitario = paraCentavos(itemArg.custoUnitario);
        if (!produtoId || !quantidade || quantidade <= 0 || !custoUnitario || custoUnitario <= 0) {
          return { success: false, error_code: "ITEM_INVALIDO", message: "Um dos itens está com produto, quantidade ou custo inválido." };
        }
        const produto = await buscarProdutoPorId(produtoId);
        if (!produto) return { success: false, error_code: "PRODUTO_NAO_ENCONTRADO", message: "Um dos produtos informados não foi encontrado." };
        nomesPorId.set(produtoId, produto.nome);
        itensResolvidos.push({ produtoId, quantidade, quantidadeDemonstracao, custoUnitario });
      }

      const valorFrete = paraCentavos(args.valorFrete) ?? 0;
      const observacoes = texto(args.observacoes) ?? null;

      const itensExibicao = itensResolvidos.map((item) => ({
        produto: nomesPorId.get(item.produtoId) ?? item.produtoId,
        quantidade: item.quantidade,
        quantidadeDemonstracao: item.quantidadeDemonstracao,
        custoUnitario: centavosParaReais(item.custoUnitario),
      }));
      const totalPedido =
        itensResolvidos.reduce((soma, item) => soma + item.custoUnitario * (item.quantidade + item.quantidadeDemonstracao), 0) + valorFrete;

      return {
        success: true,
        data: {
          fornecedor: fornecedor.nome,
          itens: itensExibicao,
          valorFrete: centavosParaReais(valorFrete),
          totalPedido: centavosParaReais(totalPedido),
          resolvido: { fornecedorId, itens: itensResolvidos, valorFrete, observacoes },
        },
        message: `Confira o pedido de compra: fornecedor ${fornecedor.nome}, ${itensExibicao.length} produto(s), frete ${centavosParaReais(valorFrete)}, total ${centavosParaReais(totalPedido)}. O pedido fica como RASCUNHO — ainda precisa ser enviado e recebido na tela de Compras. Confirma o registro do rascunho?`,
      };
    },
  },
  {
    nome: "quote_shipping",
    descricao:
      "Cotação de frete via Melhor Envio para um trajeto e embalagem informados manualmente. NUNCA compra o frete, gera etiqueta ou cria qualquer envio — é só uma consulta de preço/prazo, executada direto (não precisa de confirmação). Requer a integração com o Melhor Envio já conectada (avise o usuário se a ferramenta reportar que não está).",
    recurso: "fretes",
    nivel: 1,
    exigeEscrita: true,
    parametros: {
      type: "object",
      properties: {
        cepOrigem: { type: "string" },
        cepDestino: { type: "string" },
        pesoKg: { type: "number" },
        alturaCm: { type: "number" },
        larguraCm: { type: "number" },
        comprimentoCm: { type: "number" },
        valorDeclarado: { type: "string", description: "Valor declarado da mercadoria em reais, opcional" },
        nomeReferencia: { type: "string" },
        observacao: { type: "string" },
      },
      required: ["cepOrigem", "cepDestino", "pesoKg", "alturaCm", "larguraCm", "comprimentoCm"],
    },
    handler: async (args, usuario) => {
      const cepOrigem = texto(args.cepOrigem) ?? "";
      const cepDestino = texto(args.cepDestino) ?? "";
      const pesoKg = numero(args.pesoKg);
      const alturaCm = numero(args.alturaCm);
      const larguraCm = numero(args.larguraCm);
      const comprimentoCm = numero(args.comprimentoCm);
      if (!cepOrigem || !cepDestino || !pesoKg || !alturaCm || !larguraCm || !comprimentoCm) {
        return {
          success: false,
          error_code: "DADOS_INCOMPLETOS",
          message: "Preciso do CEP de origem, CEP de destino, peso e as três dimensões (altura, largura, comprimento) da embalagem.",
        };
      }

      const umMinutoAtras = new Date(Date.now() - 60_000);
      const quantidadeRecente = await prisma.cotacaoFrete.count({ where: { usuarioId: usuario.id, createdAt: { gte: umMinutoAtras } } });
      if (quantidadeRecente >= 12) {
        return { success: false, error_code: "LIMITE_EXCEDIDO", message: "Muitas cotações de frete em pouco tempo. Aguarde um instante e tente de novo." };
      }

      const dados: DadosCotacao = {
        cepOrigem,
        cepDestino,
        pesoKg,
        alturaCm,
        larguraCm,
        comprimentoCm,
        valorDeclaradoCentavos: paraCentavos(args.valorDeclarado),
        nomeReferencia: texto(args.nomeReferencia),
        observacao: texto(args.observacao),
      };

      try {
        const resultado = await cotarFrete(dados, usuario);
        const cotacaoSalva = await registrarCotacao({ usuarioId: usuario.id, ambiente: melhorEnvioConfig.environment, dados, resultado });
        await registrarAuditoria({
          usuarioId: usuario.id,
          acao: "frete.cotar",
          entidade: "CotacaoFrete",
          entidadeId: cotacaoSalva.id,
          detalhes: `Origem: Assistente de IA | ${resultado.opcoes.length} opção(ões), ${resultado.indisponiveis.length} indisponível(is)`,
        });

        const opcoesOrdenadas = ordenarOpcoes(resultado.opcoes, "menor_preco");
        return {
          success: true,
          data: {
            opcoes: opcoesOrdenadas.map((opcao) => ({
              transportadora: opcao.transportadora,
              servico: opcao.servico,
              preco: centavosParaReais(opcao.precoCentavos),
              prazoDias: opcao.prazoDias,
            })),
            indisponiveis: resultado.indisponiveis,
          },
          message:
            opcoesOrdenadas.length === 0
              ? "Nenhuma transportadora retornou opção disponível para esse trajeto/embalagem."
              : `${opcoesOrdenadas.length} opção(ões) de frete encontrada(s), da mais barata pra mais cara. Isso é só uma cotação — nada foi comprado.`,
        };
      } catch (erro) {
        const mensagem =
          erro instanceof ErroMelhorEnvio || erro instanceof ErroOAuthMelhorEnvio
            ? erro.message
            : "Não foi possível calcular o frete neste momento. Tente novamente.";
        await registrarCotacao({ usuarioId: usuario.id, ambiente: melhorEnvioConfig.environment, dados, erro: mensagem });
        await registrarAuditoria({
          usuarioId: usuario.id,
          acao: "frete.cotar_erro",
          entidade: "CotacaoFrete",
          detalhes: `Origem: Assistente de IA | ${mensagem}`,
        });
        return { success: false, error_code: "ERRO_COTACAO", message: mensagem };
      }
    },
  },
];
