import { PrismaClient } from "@prisma/client";

// Singleton do PrismaClient — ponto único de troca para a Fase 2 (Supabase Postgres):
// basta mudar o provider em prisma/schema.prisma e o DATABASE_URL, nada aqui muda.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
