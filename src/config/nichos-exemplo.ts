/**
 * Exemplos de configuração por segmento.
 *
 * Nenhum deles é importado pelo sistema — servem de ponto de partida: copie o
 * conteúdo do que mais se parece com o cliente e cole em `nicho.ts`, na
 * constante `nicho`.
 */

import type { ConfigNicho } from "./nicho";

export const PERFUMARIA: ConfigNicho = {
  negocio: { nome: "Le Parfum", segmento: "perfumaria", logoPath: "/logo.jpg" },
  termos: {
    produto: { singular: "Perfume", plural: "Perfumes" },
    marca: "Marca",
    categoria: "Categoria",
    cliente: { singular: "Cliente", plural: "Clientes" },
    fornecedor: { singular: "Fornecedor", plural: "Fornecedores" },
  },
  atributos: {
    medida: { ativo: true, rotulo: "Tamanho", unidade: "ml" },
    atributoA: {
      ativo: true,
      rotulo: "Família olfativa",
      opcoes: [
        { valor: "amadeirado", rotulo: "Amadeirado" },
        { valor: "floral", rotulo: "Floral" },
        { valor: "citrico", rotulo: "Cítrico" },
        { valor: "oriental", rotulo: "Oriental" },
        { valor: "doce", rotulo: "Doce" },
      ],
    },
    atributoB: {
      ativo: true,
      rotulo: "Público",
      opcoes: [
        { valor: "MASCULINO", rotulo: "Masculino" },
        { valor: "FEMININO", rotulo: "Feminino" },
        { valor: "UNISSEX", rotulo: "Unissex" },
      ],
    },
  },
  estoque: {
    poolDemonstracao: { ativo: true, rotulo: "Testador" },
    controlaValidade: true,
    vendaFracionada: { ativo: true, rotulo: "Decant" },
  },
  perfisDeCompra: [
    { chave: "masculino", rotulo: "Compradores de masculino", quando: { tipo: "atributoB", valor: "MASCULINO" } },
    { chave: "feminino", rotulo: "Compradores de feminino", quando: { tipo: "atributoB", valor: "FEMININO" } },
    { chave: "bodysplash", rotulo: "Compradores de body splash", quando: { tipo: "categoriaContem", texto: "body splash" } },
    { chave: "miniatura", rotulo: "Compradores de miniatura", quando: { tipo: "medidaAte", valor: 10 } },
    { chave: "decant", rotulo: "Compradores de decant", quando: { tipo: "vendaFracionada" } },
  ],
  categoriasProdutoIniciais: ["Perfume", "Body Splash", "Hidratante", "Kit"],
  categoriasDespesaIniciais: ["Aluguel", "Energia", "Embalagens", "Marketing", "Impostos", "Frete", "Outros"],
};

export const AUTOPECAS: ConfigNicho = {
  negocio: { nome: "Auto Peças", segmento: "autopeças", logoPath: "/logo.svg" },
  termos: {
    produto: { singular: "Peça", plural: "Peças" },
    marca: "Fabricante",
    categoria: "Sistema",
    cliente: { singular: "Cliente", plural: "Clientes" },
    fornecedor: { singular: "Distribuidor", plural: "Distribuidores" },
  },
  atributos: {
    medida: { ativo: false, rotulo: "Medida", unidade: "mm" },
    atributoA: {
      ativo: true,
      rotulo: "Aplicação",
      opcoes: [],
      ajuda: "Veículo/motor em que a peça se aplica.",
    },
    atributoB: {
      ativo: true,
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
    { chave: "freios", rotulo: "Compradores de freios", quando: { tipo: "categoriaContem", texto: "freio" } },
    { chave: "motor", rotulo: "Compradores de motor", quando: { tipo: "categoriaContem", texto: "motor" } },
  ],
  categoriasProdutoIniciais: ["Freios", "Suspensão", "Motor", "Elétrica", "Filtros"],
  categoriasDespesaIniciais: ["Aluguel", "Energia", "Ferramentas", "Marketing", "Impostos", "Frete", "Outros"],
};

export const FARMACIA: ConfigNicho = {
  negocio: { nome: "Farmácia", segmento: "farmácia", logoPath: "/logo.svg" },
  termos: {
    produto: { singular: "Medicamento", plural: "Medicamentos" },
    marca: "Laboratório",
    categoria: "Classe",
    cliente: { singular: "Cliente", plural: "Clientes" },
    fornecedor: { singular: "Distribuidora", plural: "Distribuidoras" },
  },
  atributos: {
    medida: { ativo: true, rotulo: "Dosagem", unidade: "mg" },
    atributoA: { ativo: true, rotulo: "Princípio ativo", opcoes: [] },
    atributoB: {
      ativo: true,
      rotulo: "Tarja",
      opcoes: [
        { valor: "livre", rotulo: "Sem tarja" },
        { valor: "vermelha", rotulo: "Tarja vermelha" },
        { valor: "preta", rotulo: "Tarja preta" },
      ],
    },
  },
  estoque: {
    poolDemonstracao: { ativo: false, rotulo: "Amostra" },
    controlaValidade: true,
    vendaFracionada: { ativo: false, rotulo: "Fracionado" },
  },
  perfisDeCompra: [
    { chave: "tarja_vermelha", rotulo: "Compradores com receita", quando: { tipo: "atributoB", valor: "vermelha" } },
    { chave: "dermo", rotulo: "Compradores de dermocosmético", quando: { tipo: "categoriaContem", texto: "dermo" } },
  ],
  categoriasProdutoIniciais: ["Genérico", "Similar", "Referência", "Higiene", "Dermocosmético"],
  categoriasDespesaIniciais: ["Aluguel", "Energia", "Embalagens", "Impostos", "Salários", "Frete", "Outros"],
};

export const PETSHOP: ConfigNicho = {
  negocio: { nome: "Pet Shop", segmento: "pet shop", logoPath: "/logo.svg" },
  termos: {
    produto: { singular: "Produto", plural: "Produtos" },
    marca: "Marca",
    categoria: "Categoria",
    cliente: { singular: "Tutor", plural: "Tutores" },
    fornecedor: { singular: "Fornecedor", plural: "Fornecedores" },
  },
  atributos: {
    medida: { ativo: true, rotulo: "Peso", unidade: "kg" },
    atributoA: {
      ativo: true,
      rotulo: "Espécie",
      opcoes: [
        { valor: "cao", rotulo: "Cão" },
        { valor: "gato", rotulo: "Gato" },
        { valor: "ave", rotulo: "Ave" },
        { valor: "outros", rotulo: "Outros" },
      ],
    },
    atributoB: {
      ativo: true,
      rotulo: "Porte",
      opcoes: [
        { valor: "pequeno", rotulo: "Pequeno" },
        { valor: "medio", rotulo: "Médio" },
        { valor: "grande", rotulo: "Grande" },
      ],
    },
  },
  estoque: {
    poolDemonstracao: { ativo: false, rotulo: "Amostra" },
    controlaValidade: true,
    vendaFracionada: { ativo: true, rotulo: "A granel" },
  },
  perfisDeCompra: [
    { chave: "cao", rotulo: "Tutores de cão", quando: { tipo: "atributoA", valor: "cao" } },
    { chave: "gato", rotulo: "Tutores de gato", quando: { tipo: "atributoA", valor: "gato" } },
    { chave: "granel", rotulo: "Compradores a granel", quando: { tipo: "vendaFracionada" } },
  ],
  categoriasProdutoIniciais: ["Ração", "Petisco", "Higiene", "Brinquedo", "Acessório", "Medicamento"],
  categoriasDespesaIniciais: ["Aluguel", "Energia", "Embalagens", "Marketing", "Impostos", "Frete", "Outros"],
};
