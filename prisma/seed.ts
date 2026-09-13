import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nicho } from "../src/config/nicho";

const prisma = new PrismaClient();

/**
 * Cria um acesso de administração se ele ainda não existir.
 *
 * Nunca mexe em usuário existente: rodar o seed de novo num banco que já está
 * em uso não pode ressuscitar uma senha antiga nem sobrescrever a que o dono
 * trocou.
 */
async function garantirAcesso(params: {
  rotulo: string;
  email: string;
  senha: string;
  nome: string;
  papel: "ADMIN" | "OWNER";
}) {
  const { rotulo, email, senha, nome, papel } = params;

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`${rotulo}: já existe (${email}), nada a fazer.`);
    return;
  }

  const senhaHash = await bcrypt.hash(senha, 10);
  await prisma.usuario.create({ data: { nome, email, senhaHash, papel } });
  console.log(`${rotulo}: criado — ${email} / senha: ${senha}`);
}

async function main() {
  // Dois acessos de administração desde o início, a pedido do cliente:
  //   - ADMIN: conta técnica, para manutenção futura;
  //   - OWNER: o dono da loja (exibido como "Sócio"), que é quem cadastra os
  //     demais usuários depois.
  // Os dois têm o mesmo acesso; existem separados para não se confundirem na
  // tela nem na auditoria. Só eles escrevem em "usuarios" (ver
  // src/lib/permissoes.ts), e é isso que garante que mais ninguém abra acesso.
  await garantirAcesso({
    rotulo: "Admin (manutenção)",
    papel: "ADMIN",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@vmmotopecas.com.br",
    senha: process.env.SEED_ADMIN_SENHA ?? "troque-esta-senha",
    nome: process.env.SEED_ADMIN_NOME ?? "Administrador do Sistema",
  });

  await garantirAcesso({
    rotulo: "Dono da loja (sócio)",
    papel: "OWNER",
    email: process.env.SEED_OWNER_EMAIL ?? "dono@empresa.local",
    senha: process.env.SEED_OWNER_SENHA ?? "troque-esta-senha",
    nome: process.env.SEED_OWNER_NOME ?? "Dono do Negócio",
  });

  console.log("Troque as duas senhas no primeiro acesso, em /usuarios.");

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
