import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nicho } from "../src/config/nicho";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_OWNER_EMAIL ?? "dono@empresa.local";
  const senha = process.env.SEED_OWNER_SENHA ?? "troque-esta-senha";
  const nome = process.env.SEED_OWNER_NOME ?? "Dono do Negócio";

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`Usuário owner já existe (${email}), nada a fazer.`);
  } else {
    const senhaHash = await bcrypt.hash(senha, 10);
    await prisma.usuario.create({ data: { nome, email, senhaHash, papel: "OWNER" } });
    console.log(`Usuário OWNER criado: ${email} / senha: ${senha}`);
    console.log("Troque a senha assim que possível em /usuarios.");
  }

  // Categorias de despesa vêm do nicho configurado — cada segmento gasta com
  // coisas diferentes, e sem elas a tela de despesas nasce inutilizável.
  const criadas: string[] = [];
  for (const nomeCategoria of nicho.categoriasDespesaIniciais) {
    const ja = await prisma.categoriaDespesa.findFirst({ where: { nome: nomeCategoria } });
    if (!ja) {
      await prisma.categoriaDespesa.create({ data: { nome: nomeCategoria } });
      criadas.push(nomeCategoria);
    }
  }
  console.log(
    criadas.length > 0
      ? `Categorias de despesa criadas: ${criadas.join(", ")}`
      : "Categorias de despesa já existiam."
  );

  console.log(`\nNicho configurado: ${nicho.negocio.nome} (${nicho.negocio.segmento}).`);
  console.log("Ajuste src/config/nicho.ts antes de cadastrar produtos.");
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
