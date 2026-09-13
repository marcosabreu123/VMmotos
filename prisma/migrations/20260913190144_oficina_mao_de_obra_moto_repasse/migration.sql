-- CreateEnum
CREATE TYPE "StatusRepasse" AS ENUM ('PENDENTE', 'A_PAGAR', 'PAGO', 'CANCELADO');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "documento" TEXT;

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "motoId" TEXT,
ADD COLUMN     "vendaGarantiaDeId" TEXT;

-- CreateTable
CREATE TABLE "Mecanico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "socioOficina" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mecanico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moto" (
    "id" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "modelo" TEXT,
    "clienteId" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Moto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemVendaServico" (
    "id" TEXT NOT NULL,
    "vendaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,

    CONSTRAINT "ItemVendaServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepasseMaoDeObra" (
    "id" TEXT NOT NULL,
    "itemVendaServicoId" TEXT NOT NULL,
    "mecanicoId" TEXT NOT NULL,
    "percentual" INTEGER NOT NULL,
    "valor" INTEGER NOT NULL,
    "status" "StatusRepasse" NOT NULL DEFAULT 'PENDENTE',
    "fechamentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepasseMaoDeObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FechamentoRepasse" (
    "id" TEXT NOT NULL,
    "mecanicoId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "total" INTEGER NOT NULL,
    "despesaId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FechamentoRepasse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mecanico_ativo_idx" ON "Mecanico"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Moto_placa_key" ON "Moto"("placa");

-- CreateIndex
CREATE INDEX "Moto_clienteId_idx" ON "Moto"("clienteId");

-- CreateIndex
CREATE INDEX "ItemVendaServico_vendaId_idx" ON "ItemVendaServico"("vendaId");

-- CreateIndex
CREATE INDEX "RepasseMaoDeObra_mecanicoId_status_idx" ON "RepasseMaoDeObra"("mecanicoId", "status");

-- CreateIndex
CREATE INDEX "RepasseMaoDeObra_itemVendaServicoId_idx" ON "RepasseMaoDeObra"("itemVendaServicoId");

-- CreateIndex
CREATE INDEX "FechamentoRepasse_inicio_fim_idx" ON "FechamentoRepasse"("inicio", "fim");

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoRepasse_mecanicoId_inicio_fim_key" ON "FechamentoRepasse"("mecanicoId", "inicio", "fim");

-- CreateIndex
CREATE INDEX "Venda_motoId_idx" ON "Venda"("motoId");

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_motoId_fkey" FOREIGN KEY ("motoId") REFERENCES "Moto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_vendaGarantiaDeId_fkey" FOREIGN KEY ("vendaGarantiaDeId") REFERENCES "Venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moto" ADD CONSTRAINT "Moto_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVendaServico" ADD CONSTRAINT "ItemVendaServico_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepasseMaoDeObra" ADD CONSTRAINT "RepasseMaoDeObra_itemVendaServicoId_fkey" FOREIGN KEY ("itemVendaServicoId") REFERENCES "ItemVendaServico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepasseMaoDeObra" ADD CONSTRAINT "RepasseMaoDeObra_mecanicoId_fkey" FOREIGN KEY ("mecanicoId") REFERENCES "Mecanico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepasseMaoDeObra" ADD CONSTRAINT "RepasseMaoDeObra_fechamentoId_fkey" FOREIGN KEY ("fechamentoId") REFERENCES "FechamentoRepasse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FechamentoRepasse" ADD CONSTRAINT "FechamentoRepasse_mecanicoId_fkey" FOREIGN KEY ("mecanicoId") REFERENCES "Mecanico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
