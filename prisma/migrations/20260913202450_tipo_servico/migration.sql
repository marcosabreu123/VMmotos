-- AlterTable
ALTER TABLE "ItemVendaServico" ADD COLUMN     "tipoServicoId" TEXT;

-- CreateTable
CREATE TABLE "TipoServico" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipoServico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoServico_nome_key" ON "TipoServico"("nome");

-- CreateIndex
CREATE INDEX "TipoServico_ativo_idx" ON "TipoServico"("ativo");

-- AddForeignKey
ALTER TABLE "ItemVendaServico" ADD CONSTRAINT "ItemVendaServico_tipoServicoId_fkey" FOREIGN KEY ("tipoServicoId") REFERENCES "TipoServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;
