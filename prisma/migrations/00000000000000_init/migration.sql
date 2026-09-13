-- Migração inicial do ERP base.
--
-- Extensões usadas pela busca em linguagem natural:
--   unaccent  -> "jose" encontra "José"
--   pg_trgm   -> similaridade, tolera erro de digitação ("lataffa" -> "Lattafa")
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('OWNER', 'GERENTE', 'SELLER', 'ESTOQUE', 'CONSULTA');

-- CreateEnum
CREATE TYPE "TipoVenda" AS ENUM ('UNIDADE', 'FRACIONADO');

-- CreateEnum
CREATE TYPE "StatusLote" AS ENUM ('ATIVO', 'ESGOTADO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "StatusPedido" AS ENUM ('RASCUNHO', 'ENVIADO', 'RECEBIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX');

-- CreateEnum
CREATE TYPE "StatusVenda" AS ENUM ('CONCLUIDA', 'CANCELADA', 'DEVOLVIDA_PARCIAL', 'DEVOLVIDA_TOTAL');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('ENTRADA_COMPRA', 'ENTRADA_MANUAL', 'ENTRADA_ESTOQUE', 'SAIDA_VENDA', 'SAIDA_DEMONSTRACAO', 'TRANSFERENCIA_DEMONSTRACAO', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'PERDA_VENCIMENTO', 'PERDA_DEFEITO', 'BRINDE', 'DEVOLUCAO', 'ESTORNO_CANCELAMENTO');

-- CreateEnum
CREATE TYPE "PoolEstoque" AS ENUM ('VENDA', 'DEMONSTRACAO');

-- CreateEnum
CREATE TYPE "StatusDespesa" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FormaPagamentoDespesa" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'BOLETO', 'TRANSFERENCIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "ClassificacaoDespesa" AS ENUM ('FIXA', 'VARIAVEL', 'ADMINISTRATIVA', 'COMERCIAL', 'OPERACIONAL', 'MARKETING', 'EXCEPCIONAL');

-- CreateEnum
CREATE TYPE "TipoRecorrencia" AS ENUM ('NENHUMA', 'SEMANAL', 'MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "StatusRecorrencia" AS ENUM ('ATIVA', 'PAUSADA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "TipoEntradaAssistente" AS ENUM ('TEXTO', 'AUDIO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'SELLER',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "detalhes" TEXT,
    "valorAnterior" INTEGER,
    "valorNovo" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "medida" INTEGER,
    "sku" TEXT NOT NULL,
    "codigoBarras" TEXT,
    "precoCustoRef" INTEGER NOT NULL,
    "precoVenda" INTEGER NOT NULL,
    "fornecedorId" TEXT,
    "fotoPath" TEXT,
    "atributoA" TEXT,
    "atributoB" TEXT,
    "tipoVenda" "TipoVenda" NOT NULL DEFAULT 'UNIDADE',
    "estoqueMinimo" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "curvaAbc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dataValidade" TIMESTAMP(3),
    "custoUnitario" INTEGER NOT NULL,
    "freteRateado" INTEGER NOT NULL DEFAULT 0,
    "custoReal" INTEGER NOT NULL,
    "quantidadeInicialVenda" INTEGER NOT NULL,
    "quantidadeAtualVenda" INTEGER NOT NULL,
    "quantidadeInicialDemonstracao" INTEGER NOT NULL DEFAULT 0,
    "quantidadeAtualDemonstracao" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusLote" NOT NULL DEFAULT 'ATIVO',
    "itemPedidoId" TEXT,
    "itemEntradaEstoqueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoDeCompra" (
    "id" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "dataPedido" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataRecebimento" TIMESTAMP(3),
    "valorFrete" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusPedido" NOT NULL DEFAULT 'RASCUNHO',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoDeCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPedidoDeCompra" (
    "id" TEXT NOT NULL,
    "pedidoCompraId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "quantidadeDemonstracao" INTEGER NOT NULL DEFAULT 0,
    "custoUnitario" INTEGER NOT NULL,

    CONSTRAINT "ItemPedidoDeCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoSegmentacaoClientes" (
    "id" TEXT NOT NULL,
    "diasInativo" INTEGER NOT NULL DEFAULT 90,
    "diasRecuperado" INTEGER NOT NULL DEFAULT 30,
    "valorAltoTicketCentavos" INTEGER NOT NULL DEFAULT 30000,
    "valorVipCentavos" INTEGER NOT NULL DEFAULT 100000,
    "comprasRecorrente" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoSegmentacaoClientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,
    "clienteId" TEXT,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "descontoTotal" INTEGER NOT NULL DEFAULT 0,
    "acrescimoTotal" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "valorPago" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusVenda" NOT NULL DEFAULT 'CONCLUIDA',
    "observacoes" TEXT,
    "motivoCancelamento" TEXT,
    "canceladoPorId" TEXT,
    "canceladoEm" TIMESTAMP(3),

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVenda" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" INTEGER NOT NULL,
    "descontoItem" INTEGER NOT NULL DEFAULT 0,
    "custoRealSnapshot" INTEGER NOT NULL,
    "subtotalItem" INTEGER NOT NULL,

    CONSTRAINT "ItemVenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devolucao" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Devolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDevolucao" (
    "id" TEXT NOT NULL,
    "devolucaoId" TEXT NOT NULL,
    "itemVendaId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "retornaEstoque" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ItemDevolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "loteId" TEXT,
    "tipo" "TipoMovimentacao" NOT NULL,
    "pool" "PoolEstoque" NOT NULL DEFAULT 'VENDA',
    "quantidade" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vendaId" TEXT,
    "pedidoCompraId" TEXT,
    "entradaEstoqueId" TEXT,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntradaEstoque" (
    "id" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valorFrete" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntradaEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEntradaEstoque" (
    "id" TEXT NOT NULL,
    "entradaEstoqueId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "custoUnitario" INTEGER NOT NULL,

    CONSTRAINT "ItemEntradaEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaDespesa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriaDespesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "fornecedorId" TEXT,
    "valor" INTEGER NOT NULL,
    "dataDespesa" TIMESTAMP(3) NOT NULL,
    "vencimento" TIMESTAMP(3),
    "dataPagamento" TIMESTAMP(3),
    "status" "StatusDespesa" NOT NULL DEFAULT 'PENDENTE',
    "formaPagamento" "FormaPagamentoDespesa",
    "classificacao" "ClassificacaoDespesa" NOT NULL,
    "entraNoLucroLiquido" BOOLEAN NOT NULL DEFAULT true,
    "comprovantePath" TEXT,
    "observacoes" TEXT,
    "recorrencia" "TipoRecorrencia" NOT NULL DEFAULT 'NENHUMA',
    "statusRecorrencia" "StatusRecorrencia",
    "despesaOrigemId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "canceladoPorId" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "custoUnitario" INTEGER NOT NULL,
    "estoqueAtual" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVendaInsumo" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "custoRealSnapshot" INTEGER NOT NULL,

    CONSTRAINT "ItemVendaInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistenteConversa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "previewFerramenta" TEXT,
    "previewArgs" JSONB,
    "previewCriadoEm" TIMESTAMP(3),

    CONSTRAINT "AssistenteConversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistenteInteracao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "mensagemOriginal" TEXT NOT NULL,
    "tipoEntrada" "TipoEntradaAssistente" NOT NULL,
    "transcricao" TEXT,
    "intentJson" JSONB,
    "ferramenta" TEXT,
    "argumentosJson" JSONB,
    "resultadoJson" JSONB,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistenteInteracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoAssistente" (
    "id" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "limiteDiarioPorUsuario" INTEGER NOT NULL DEFAULT 200,
    "valorAltoCentavos" INTEGER NOT NULL DEFAULT 50000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoAssistente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegracaoMelhorEnvio" (
    "id" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'desconectado',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenType" TEXT,
    "scopes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "refreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegracaoMelhorEnvio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MelhorEnvioOAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MelhorEnvioOAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotacaoFrete" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "cepOrigem" TEXT NOT NULL,
    "cepDestino" TEXT NOT NULL,
    "pesoKg" DOUBLE PRECISION NOT NULL,
    "alturaCm" DOUBLE PRECISION NOT NULL,
    "larguraCm" DOUBLE PRECISION NOT NULL,
    "comprimentoCm" DOUBLE PRECISION NOT NULL,
    "valorDeclaradoCentavos" INTEGER,
    "nomeReferencia" TEXT,
    "observacao" TEXT,
    "quantidadeOpcoes" INTEGER NOT NULL DEFAULT 0,
    "menorPrecoCentavos" INTEGER,
    "menorPrazoDias" INTEGER,
    "status" TEXT NOT NULL,
    "erro" TEXT,
    "opcaoSelecionadaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CotacaoFrete_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_createdAt_idx" ON "RegistroAuditoria"("createdAt");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_entidade_entidadeId_idx" ON "RegistroAuditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_sku_key" ON "Produto"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_codigoBarras_key" ON "Produto"("codigoBarras");

-- CreateIndex
CREATE INDEX "Produto_categoria_idx" ON "Produto"("categoria");

-- CreateIndex
CREATE INDEX "Produto_atributoA_idx" ON "Produto"("atributoA");

-- CreateIndex
CREATE INDEX "Produto_atributoB_idx" ON "Produto"("atributoB");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_itemPedidoId_key" ON "Lote"("itemPedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_itemEntradaEstoqueId_key" ON "Lote"("itemEntradaEstoqueId");

-- CreateIndex
CREATE INDEX "Lote_produtoId_dataValidade_idx" ON "Lote"("produtoId", "dataValidade");

-- CreateIndex
CREATE INDEX "Venda_dataHora_idx" ON "Venda"("dataHora");

-- CreateIndex
CREATE INDEX "Venda_status_idx" ON "Venda"("status");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_produtoId_createdAt_idx" ON "MovimentacaoEstoque"("produtoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaDespesa_nome_key" ON "CategoriaDespesa"("nome");

-- CreateIndex
CREATE INDEX "Despesa_dataDespesa_idx" ON "Despesa"("dataDespesa");

-- CreateIndex
CREATE INDEX "Despesa_status_idx" ON "Despesa"("status");

-- CreateIndex
CREATE INDEX "Despesa_categoriaId_idx" ON "Despesa"("categoriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Despesa_despesaOrigemId_dataDespesa_key" ON "Despesa"("despesaOrigemId", "dataDespesa");

-- CreateIndex
CREATE INDEX "AssistenteConversa_usuarioId_ativa_idx" ON "AssistenteConversa"("usuarioId", "ativa");

-- CreateIndex
CREATE UNIQUE INDEX "AssistenteInteracao_requestId_key" ON "AssistenteInteracao"("requestId");

-- CreateIndex
CREATE INDEX "AssistenteInteracao_conversaId_createdAt_idx" ON "AssistenteInteracao"("conversaId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistenteInteracao_usuarioId_createdAt_idx" ON "AssistenteInteracao"("usuarioId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegracaoMelhorEnvio_ambiente_key" ON "IntegracaoMelhorEnvio"("ambiente");

-- CreateIndex
CREATE UNIQUE INDEX "MelhorEnvioOAuthState_state_key" ON "MelhorEnvioOAuthState"("state");

-- CreateIndex
CREATE INDEX "CotacaoFrete_usuarioId_createdAt_idx" ON "CotacaoFrete"("usuarioId", "createdAt");

-- CreateIndex
CREATE INDEX "CotacaoFrete_cepDestino_idx" ON "CotacaoFrete"("cepDestino");

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_itemPedidoId_fkey" FOREIGN KEY ("itemPedidoId") REFERENCES "ItemPedidoDeCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_itemEntradaEstoqueId_fkey" FOREIGN KEY ("itemEntradaEstoqueId") REFERENCES "ItemEntradaEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoDeCompra" ADD CONSTRAINT "PedidoDeCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedidoDeCompra" ADD CONSTRAINT "ItemPedidoDeCompra_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "PedidoDeCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPedidoDeCompra" ADD CONSTRAINT "ItemPedidoDeCompra_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucao" ADD CONSTRAINT "Devolucao_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucao" ADD CONSTRAINT "Devolucao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDevolucao" ADD CONSTRAINT "ItemDevolucao_devolucaoId_fkey" FOREIGN KEY ("devolucaoId") REFERENCES "Devolucao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDevolucao" ADD CONSTRAINT "ItemDevolucao_itemVendaId_fkey" FOREIGN KEY ("itemVendaId") REFERENCES "ItemVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_pedidoCompraId_fkey" FOREIGN KEY ("pedidoCompraId") REFERENCES "PedidoDeCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_entradaEstoqueId_fkey" FOREIGN KEY ("entradaEstoqueId") REFERENCES "EntradaEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaEstoque" ADD CONSTRAINT "EntradaEstoque_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntradaEstoque" ADD CONSTRAINT "EntradaEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEntradaEstoque" ADD CONSTRAINT "ItemEntradaEstoque_entradaEstoqueId_fkey" FOREIGN KEY ("entradaEstoqueId") REFERENCES "EntradaEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEntradaEstoque" ADD CONSTRAINT "ItemEntradaEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaDespesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_despesaOrigemId_fkey" FOREIGN KEY ("despesaOrigemId") REFERENCES "Despesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVendaInsumo" ADD CONSTRAINT "ItemVendaInsumo_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVendaInsumo" ADD CONSTRAINT "ItemVendaInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistenteConversa" ADD CONSTRAINT "AssistenteConversa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistenteInteracao" ADD CONSTRAINT "AssistenteInteracao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistenteInteracao" ADD CONSTRAINT "AssistenteInteracao_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "AssistenteConversa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegracaoMelhorEnvio" ADD CONSTRAINT "IntegracaoMelhorEnvio_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MelhorEnvioOAuthState" ADD CONSTRAINT "MelhorEnvioOAuthState_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotacaoFrete" ADD CONSTRAINT "CotacaoFrete_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Índices trigrama que aceleram a busca aproximada.
CREATE INDEX IF NOT EXISTS "Produto_nome_trgm_idx" ON "Produto" USING gin (lower(nome) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Produto_marca_trgm_idx" ON "Produto" USING gin (lower(marca) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Cliente_nome_trgm_idx" ON "Cliente" USING gin (lower(nome) gin_trgm_ops);
