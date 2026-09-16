import { prisma } from "./db";
import { Prisma, type TipoVenda } from "@prisma/client";
import { tokensDeBusca, condicaoTokenProduto, relevanciaProduto, juntarTokens, contarTokens, minimoTokens } from "./busca";

export type DadosProduto = {
  nome: string;
  marca: string;
  categoria: string;
  medida: number | null;
  sku: string;
  codigoBarras: string | null;
  precoCustoRef: number;
  precoVenda: number;
  fornecedorId: string | null;
  atributoA: string | null;
  atributoB: string | null;
  tipoVenda: TipoVenda;
  estoqueMinimo: number;
};

export async function listarProdutos(busca?: string, apenasArquivados = false) {
  return prisma.produto.findMany({
    where: {
      ativo: !apenasArquivados,
      ...(busca
        ? {
            OR: [
              { nome: { contains: busca, mode: "insensitive" } },
              { marca: { contains: busca, mode: "insensitive" } },
              { sku: { contains: busca, mode: "insensitive" } },
              { codigoBarras: { contains: busca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { fornecedor: true },
    orderBy: { nome: "asc" },
  });
}

export async function alterarAtivoProduto(id: string, ativo: boolean) {
  return prisma.produto.update({ where: { id }, data: { ativo } });
}

export async function buscarProdutoPorId(id: string) {
  return prisma.produto.findUnique({
    where: { id },
    include: { fornecedor: true, lotes: { orderBy: { createdAt: "asc" } } },
  });
}

export async function buscarProdutoPorSku(sku: string) {
  return prisma.produto.findUnique({ where: { sku } });
}

/**
 * Acha a peça pelo código de barras ou pelo código interno, exigindo valor
 * EXATO. É o que o leitor de código de barras usa.
 *
 * Busca aproximada não serve aqui: o leitor bipa e a peça entra direto na
 * venda, sem ninguém conferir a lista. Um "parecido" viraria peça errada
 * vendida — melhor não achar nada e avisar.
 *
 * Não filtra por `ativo` de propósito. Quem chama decide o que fazer com peça
 * arquivada, e o cadastro precisa enxergar código já usado por peça arquivada
 * — senão o @unique do banco derruba o salvamento com um erro que não explica
 * nada para quem está no balcão.
 */
export async function buscarPorCodigoExato(codigo: string) {
  const limpo = codigo.trim();
  if (!limpo) return null;

  // Código de barras primeiro: é o que o leitor mandou. Os dois campos são
  // @unique, então findUnique resolve cada um sem ambiguidade.
  const porBarras = await prisma.produto.findUnique({ where: { codigoBarras: limpo } });
  if (porBarras) return porBarras;

  return prisma.produto.findUnique({ where: { sku: limpo } });
}

/** A mesma busca exata, no formato que a tela de venda consome. */
export async function buscarParaVendaPorCodigo(codigo: string): Promise<ProdutoParaVenda | null> {
  const produto = await buscarPorCodigoExato(codigo);
  if (!produto || !produto.ativo) return null;

  const estoques = await estoqueDeVariosProdutos([produto.id]);
  return {
    id: produto.id,
    nome: produto.nome,
    marca: produto.marca,
    categoria: produto.categoria,
    sku: produto.sku,
    codigoBarras: produto.codigoBarras,
    medida: produto.medida,
    precoVenda: produto.precoVenda,
    tipoVenda: produto.tipoVenda,
    atributoB: produto.atributoB,
    fotoPath: produto.fotoPath,
    estoqueAtual: estoques.get(produto.id) ?? 0,
  };
}

export type ProdutoParaVenda = {
  id: string;
  nome: string;
  marca: string;
  // A categoria é o que separa "Yara Perfume 100ml" de "Yara Body Splash 300ml".
  // Sem ela, quem lê a lista (inclusive o assistente de IA) não tem como saber
  // qual dos dois é qual.
  categoria: string;
  sku: string;
  codigoBarras: string | null;
  medida: number | null;
  precoVenda: number;
  tipoVenda: TipoVenda;
  atributoB: string | null;
  fotoPath: string | null;
  estoqueAtual: number;
};

// Lista para a tela de venda: sem termo, navega por categoria; com termo, busca por
// nome/marca/SKU/código de barras. Sempre traz o estoque atual (leitura, sem regra de negócio).
export async function buscarProdutosParaVenda(params: {
  termo?: string;
  atributoB?: string;
} = {}): Promise<ProdutoParaVenda[]> {
  const termoLimpo = params.termo?.trim();

  // Cada palavra do termo é procurada separadamente (com unaccent e tolerância
  // a erro de digitação) — ver src/lib/busca.ts. Os ids voltam já ordenados por
  // relevância, e essa ordem é preservada abaixo.
  let idsCorrespondentes: string[] | undefined;
  if (termoLimpo) {
    const tokens = tokensDeBusca(termoLimpo);
    const condicoes = tokens.map(condicaoTokenProduto);
    const correspondentes = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM "Produto"
      WHERE ativo = true AND ${juntarTokens(condicoes)}
      ORDER BY ${relevanciaProduto(termoLimpo)} DESC, nome ASC
      LIMIT 20
    `);
    idsCorrespondentes = correspondentes.map((p) => p.id);

    // Plano B: exigir todas as palavras não achou nada. Aceita quem atende a
    // maioria — cobre o caso de colar a linha inteira do pedido, com
    // quantidade, marca e preço junto do nome.
    if (idsCorrespondentes.length === 0 && condicoes.length > 1) {
      const parciais = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM "Produto"
        WHERE ativo = true AND (${contarTokens(condicoes)}) >= ${minimoTokens(condicoes.length)}
        ORDER BY (${contarTokens(condicoes)}) DESC, ${relevanciaProduto(termoLimpo)} DESC, nome ASC
        LIMIT 20
      `);
      idsCorrespondentes = parciais.map((p) => p.id);
    }

    if (idsCorrespondentes.length === 0) return [];
  }

  const encontrados = await prisma.produto.findMany({
    where: {
      ativo: true,
      ...(params.atributoB ? { atributoB: params.atributoB } : {}),
      ...(idsCorrespondentes ? { id: { in: idsCorrespondentes } } : {}),
    },
    take: 20,
    orderBy: { nome: "asc" },
  });

  // findMany() com `id: { in: [...] }` ignora a ordem da lista, então a
  // relevância calculada no SQL acima seria perdida — reordena aqui.
  const produtos = idsCorrespondentes
    ? idsCorrespondentes
        .map((id) => encontrados.find((p) => p.id === id))
        .filter((p): p is (typeof encontrados)[number] => p !== undefined)
    : encontrados;

  if (produtos.length === 0) return [];

  const estoques = await prisma.lote.groupBy({
    by: ["produtoId"],
    where: { produtoId: { in: produtos.map((produto) => produto.id) }, status: "ATIVO" },
    _sum: { quantidadeAtualVenda: true },
  });
  const estoquePorProduto = new Map(estoques.map((linha) => [linha.produtoId, linha._sum.quantidadeAtualVenda ?? 0]));

  return produtos.map((produto) => ({
    id: produto.id,
    nome: produto.nome,
    marca: produto.marca,
    categoria: produto.categoria,
    sku: produto.sku,
    codigoBarras: produto.codigoBarras,
    medida: produto.medida,
    precoVenda: produto.precoVenda,
    tipoVenda: produto.tipoVenda,
    atributoB: produto.atributoB,
    fotoPath: produto.fotoPath,
    estoqueAtual: estoquePorProduto.get(produto.id) ?? 0,
  }));
}

export async function criarProduto(dados: DadosProduto) {
  return prisma.produto.create({ data: dados });
}

export class ErroProduto extends Error {}

/**
 * Gera um código interno único para a peça.
 *
 * Numa motopeças o dono compra peça avulsa de fornecedor qualquer, muitas
 * vezes sem código nenhum na embalagem. Obrigá-lo a inventar um SKU no
 * balcão é a diferença entre lançar e não lançar — então o sistema inventa.
 *
 * Formato: as iniciais do nome + número sequencial ("PAST-0007"). Confere de
 * fato no banco em vez de confiar no acaso, e tenta de novo se dois
 * lançamentos caírem no mesmo código ao mesmo tempo.
 */
export async function gerarSku(nome: string): Promise<string> {
  const prefixo =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // tira os acentos separados pelo NFD
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "PECA";

  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const ultimos = await prisma.produto.findMany({
      where: { sku: { startsWith: `${prefixo}-` } },
      select: { sku: true },
    });

    const maiorNumero = ultimos.reduce((maior, { sku }) => {
      const numero = Number(sku.slice(prefixo.length + 1));
      return Number.isFinite(numero) && numero > maior ? numero : maior;
    }, 0);

    const candidato = `${prefixo}-${String(maiorNumero + 1 + tentativa).padStart(4, "0")}`;
    const existe = await prisma.produto.findUnique({ where: { sku: candidato } });
    if (!existe) return candidato;
  }

  throw new ErroProduto("Não foi possível gerar um código para a peça.");
}

export type DadosPecaRapida = {
  nome: string;
  precoVenda: number;
  /** centavos — normalmente o custo digitado na própria entrada. */
  precoCustoRef?: number;
  marca?: string;
  categoria?: string;
};

/**
 * Cadastra uma peça com o mínimo possível, direto do lançamento de pedido.
 *
 * O caminho normal (sair da entrada, abrir o cadastro completo, preencher
 * oito campos, voltar) é caro demais para a compra avulsa de uma peça só,
 * que é rotina nesta loja. Aqui só o nome é realmente exigido; fabricante e
 * categoria entram como "Não informado" e o dono completa depois em Peças,
 * se quiser.
 */
export async function criarPecaRapida(dados: DadosPecaRapida) {
  const nome = dados.nome.trim();
  if (!nome) throw new ErroProduto("Informe o nome da peça.");

  if (!Number.isInteger(dados.precoVenda) || dados.precoVenda < 0) {
    throw new ErroProduto("Preço de venda inválido.");
  }

  const custo = dados.precoCustoRef ?? 0;
  if (!Number.isInteger(custo) || custo < 0) {
    throw new ErroProduto("Custo inválido.");
  }

  return prisma.produto.create({
    data: {
      nome,
      marca: dados.marca?.trim() || "Não informado",
      categoria: dados.categoria?.trim() || "Não informado",
      sku: await gerarSku(nome),
      medida: null,
      codigoBarras: null,
      precoCustoRef: custo,
      precoVenda: dados.precoVenda,
      fornecedorId: null,
      atributoA: null,
      atributoB: null,
      tipoVenda: "UNIDADE",
      estoqueMinimo: 0,
    },
  });
}

export async function atualizarProduto(id: string, dados: DadosProduto) {
  return prisma.produto.update({ where: { id }, data: dados });
}

export async function atualizarFotoProduto(id: string, fotoPath: string) {
  return prisma.produto.update({ where: { id }, data: { fotoPath } });
}

export async function estoqueTotalProduto(produtoId: string): Promise<number> {
  const resultado = await prisma.lote.aggregate({
    where: { produtoId, status: "ATIVO" },
    _sum: { quantidadeAtualVenda: true },
  });
  return resultado._sum.quantidadeAtualVenda ?? 0;
}

/**
 * Estoque de VÁRIAS peças de uma vez.
 *
 * A tela de Peças chamava estoqueTotalProduto uma vez por peça listada. Com
 * dez peças ninguém nota; com quinhentas são quinhentas consultas disparadas
 * juntas, e o pool do Supabase tem 15 conexões — a tela passaria mais tempo
 * na fila do que consultando.
 *
 * Aqui é um groupBy só. Peça sem lote ativo não volta no resultado, por isso
 * o mapa responde 0 para quem não estiver nele.
 */
export async function estoqueDeVariosProdutos(produtoIds: string[]): Promise<Map<string, number>> {
  if (produtoIds.length === 0) return new Map();

  const linhas = await prisma.lote.groupBy({
    by: ["produtoId"],
    where: { produtoId: { in: produtoIds }, status: "ATIVO" },
    _sum: { quantidadeAtualVenda: true },
  });

  const mapa = new Map<string, number>();
  for (const id of produtoIds) mapa.set(id, 0);
  for (const linha of linhas) mapa.set(linha.produtoId, linha._sum.quantidadeAtualVenda ?? 0);
  return mapa;
}
