/**
 * PONTO ÚNICO DE PERSONALIZAÇÃO POR NICHO.
 *
 * Este arquivo é o que muda de um cliente para outro. O resto do sistema lê
 * tudo daqui — nome do negócio, vocabulário, quais atributos o produto tem e
 * como o estoque se comporta. Adaptar o sistema para um novo segmento deve
 * ser, na maior parte dos casos, editar SÓ este arquivo.
 *
 * Há exemplos prontos de outros segmentos em `nichos-exemplo.ts`.
 *
 * ---------------------------------------------------------------------------
 * CLIENTE ATUAL: VM Moto Peças — venda de peças no balcão + oficina de motos.
 *
 * Decisões tomadas com o dono (set/2026), todas na direção de "o mais simples
 * possível", porque só ele opera o sistema:
 *   - Sem validade de lote: peça não vence, e o campo só atrapalharia a entrada.
 *   - Sem venda fracionada: óleo sai em litro fechado ("não fazemos" a granel).
 *   - Sem pool de demonstração: não existe mostruário.
 *   - Um único atributo livre ligado ("Aplicação"), para não encher o
 *     formulário de peça. "Posição" (dianteira/traseira) está pronto logo
 *     abaixo, comentado — é só descomentar se um dia fizer falta.
 * ---------------------------------------------------------------------------
 */

export type OpcaoAtributo = { valor: string; rotulo: string };

export type AtributoTexto = {
  ativo: boolean;
  rotulo: string;
  /** Vazio = campo de texto livre. Preenchido = lista fechada (select). */
  opcoes: OpcaoAtributo[];
  /** Aparece como dica embaixo do campo no formulário. */
  ajuda?: string;
};

export type AtributoNumero = {
  ativo: boolean;
  rotulo: string;
  /** Sufixo exibido junto do número: "ml", "g", "cm", "V"... */
  unidade: string;
  ajuda?: string;
};

export type ConfigNicho = {
  negocio: {
    nome: string;
    /** Usado em títulos, e-mails e no prompt do assistente de IA. */
    segmento: string;
    /** Arquivo dentro de /public. */
    logoPath: string;
  };

  termos: {
    /** Como este negócio chama o que vende. */
    produto: { singular: string; plural: string };
    /** "Marca" (varejo), "Fabricante" (autopeças), "Laboratório" (farmácia)... */
    marca: string;
    /** "Categoria", "Seção", "Linha"... */
    categoria: string;
    cliente: { singular: string; plural: string };
    fornecedor: { singular: string; plural: string };
  };

  /**
   * Três atributos genéricos do produto. Cada nicho decide se usa, como chama
   * e (nos de texto) se é lista fechada ou texto livre. Desligar um atributo
   * some com ele dos formulários, filtros e relatórios.
   */
  atributos: {
    medida: AtributoNumero;
    atributoA: AtributoTexto;
    atributoB: AtributoTexto;
  };

  estoque: {
    /**
     * Segundo "bolso" de estoque, separado do que está à venda. Na perfumaria
     * é o testador; numa ótica, o mostruário; numa distribuidora, a amostra
     * do representante. Desligado = só existe estoque de venda.
     */
    poolDemonstracao: { ativo: boolean; rotulo: string };
    /** Lotes com data de validade (farmácia, alimentos, cosméticos). */
    controlaValidade: boolean;
    /** Venda por fração do item (decant, granel, corte por metro). */
    vendaFracionada: { ativo: boolean; rotulo: string };
  };

  /**
   * Perfis de compra do relatório de clientes: "quem já levou algo assim".
   * Os segmentos de comportamento (novo, recorrente, VIP, inativo...) são
   * universais e já vêm prontos; estes dependem do que o negócio vende.
   * Lista vazia = a seção não aparece no relatório.
   */
  perfisDeCompra: RegraPerfilCompra[];

  /** Criadas pelo seed quando o banco está vazio. */
  categoriasProdutoIniciais: string[];
  categoriasDespesaIniciais: string[];
};

/** Regra que classifica um cliente pelo tipo de item que ele já comprou. */
export type RegraPerfilCompra = {
  /** Identificador estável, usado como chave de contagem. */
  chave: string;
  /** Texto exibido no relatório. */
  rotulo: string;
  quando:
    | { tipo: "atributoA"; valor: string }
    | { tipo: "atributoB"; valor: string }
    | { tipo: "categoriaContem"; texto: string }
    | { tipo: "medidaAte"; valor: number }
    | { tipo: "medidaAcimaDe"; valor: number }
    | { tipo: "vendaFracionada" };
};

export const nicho: ConfigNicho = {
  negocio: {
    nome: "VM Moto Peças",
    segmento: "loja de motopeças com oficina de motos",
    logoPath: "/logo.svg",
  },

  termos: {
    // Vocabulário deliberadamente comum: quem usa o sistema não é técnico.
    produto: { singular: "Peça", plural: "Peças" },
    marca: "Fabricante",
    categoria: "Categoria",
    cliente: { singular: "Cliente", plural: "Clientes" },
    fornecedor: { singular: "Fornecedor", plural: "Fornecedores" },
  },

  atributos: {
    // Peça de moto não tem uma medida numérica única que valha um campo fixo.
    medida: {
      ativo: false,
      rotulo: "Medida",
      unidade: "mm",
    },
    // O campo que realmente importa no balcão: "essa peça serve em qual moto?".
    atributoA: {
      ativo: true,
      rotulo: "Aplicação",
      opcoes: [], // texto livre: "CG 160", "Biz 125", "Fan 125 até 2015"...
      ajuda: "Modelo de moto em que a peça serve. Ex.: CG 160, Biz 125, XRE 300.",
    },
    // Desligado de propósito, para o cadastro de peça ficar curto. Para ligar,
    // basta trocar `ativo` para true — nenhuma tela precisa ser alterada.
    atributoB: {
      ativo: false,
      rotulo: "Posição",
      opcoes: [
        { valor: "dianteira", rotulo: "Dianteira" },
        { valor: "traseira", rotulo: "Traseira" },
        { valor: "unica", rotulo: "Única" },
      ],
    },
  },

  estoque: {
    poolDemonstracao: { ativo: false, rotulo: "Mostruário" },
    controlaValidade: false,
    vendaFracionada: { ativo: false, rotulo: "Fracionado" },
  },

  perfisDeCompra: [
    { chave: "motor", rotulo: "Compradores de motor", quando: { tipo: "categoriaContem", texto: "motor" } },
    { chave: "freios", rotulo: "Compradores de freios", quando: { tipo: "categoriaContem", texto: "freio" } },
    { chave: "transmissao", rotulo: "Compradores de relação", quando: { tipo: "categoriaContem", texto: "transmiss" } },
    { chave: "pneus", rotulo: "Compradores de pneu", quando: { tipo: "categoriaContem", texto: "pneu" } },
    { chave: "oleo", rotulo: "Compradores de óleo", quando: { tipo: "categoriaContem", texto: "óleo" } },
  ],

  categoriasProdutoIniciais: [
    "Motor",
    "Freios",
    "Suspensão",
    "Transmissão",
    "Elétrica",
    "Iluminação",
    "Pneus e Câmaras",
    "Filtros",
    "Óleos e Lubrificantes",
    "Escapamento",
    "Carenagem",
    "Acessórios",
  ],

  categoriasDespesaIniciais: [
    "Aluguel",
    "Energia",
    "Água",
    "Internet e telefone",
    "Comissões", // usada no fechamento semanal da comissão dos mecânicos
    "Ferramentas",
    "Marketing",
    "Impostos",
    "Frete",
    "Manutenção da oficina",
    "Outros",
  ],
};

// ---------------------------------------------------------------------------
// Atalhos de leitura — evitam espalhar `nicho.atributos.x.ativo` pelo código.
// ---------------------------------------------------------------------------

export const usaMedida = nicho.atributos.medida.ativo;
export const usaAtributoA = nicho.atributos.atributoA.ativo;
export const usaAtributoB = nicho.atributos.atributoB.ativo;
export const usaDemonstracao = nicho.estoque.poolDemonstracao.ativo;
export const usaValidade = nicho.estoque.controlaValidade;
export const usaVendaFracionada = nicho.estoque.vendaFracionada.ativo;

/** Rótulo do pool de demonstração, já resolvido. */
export const rotuloDemonstracao = nicho.estoque.poolDemonstracao.rotulo;

/** "Tamanho (ml)" — rótulo do campo de medida já com a unidade. */
export function rotuloMedida(): string {
  const { rotulo, unidade } = nicho.atributos.medida;
  return unidade ? `${rotulo} (${unidade})` : rotulo;
}

/** "100 ml" — formata um valor de medida para exibição. */
export function formatarMedida(valor: number | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  const { unidade } = nicho.atributos.medida;
  return unidade ? `${valor} ${unidade}` : String(valor);
}

/** Rótulo de exibição de uma opção de atributo (cai no próprio valor se não achar). */
export function rotuloOpcao(atributo: "atributoA" | "atributoB", valor: string | null): string | null {
  if (!valor) return null;
  const encontrada = nicho.atributos[atributo].opcoes.find((o) => o.valor === valor);
  return encontrada ? encontrada.rotulo : valor;
}
