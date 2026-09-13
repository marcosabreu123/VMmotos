import { prisma } from "./db";

/**
 * Cadastro de motos. A placa é a chave prática: é por ela que o dono acha o
 * histórico ("essa moto já veio aqui?").
 *
 * Tudo além da placa é opcional por decisão do dono — no balcão, exigir
 * modelo ou cliente só atrasaria o atendimento.
 */

export class ErroMoto extends Error {}

/**
 * Normaliza a placa antes de qualquer gravação ou busca.
 *
 * Sem isto "abc1d23", "ABC-1D23" e "abc 1d23" viram três motos diferentes e
 * o histórico se parte em pedaços. Aceita tanto o padrão antigo (ABC1234)
 * quanto Mercosul (ABC1D23) — a validação é de formato mínimo, não de
 * placa existente: moto de outro estado, placa antiga e moto sem placa
 * legível são realidade numa oficina.
 */
export function normalizarPlaca(placa: string): string {
  return placa
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

/** Exibe "ABC1D23" como "ABC-1D23", que é como se lê uma placa. */
export function formatarPlaca(placa: string): string {
  if (placa.length !== 7) return placa;
  return `${placa.slice(0, 3)}-${placa.slice(3)}`;
}

export function validarPlaca(placa: string): string {
  const normalizada = normalizarPlaca(placa);
  if (!normalizada) throw new ErroMoto("Informe a placa da moto.");
  if (normalizada.length < 6 || normalizada.length > 8) {
    throw new ErroMoto("Placa inválida. Use algo como ABC1D23.");
  }
  return normalizada;
}

export async function listarMotos(busca?: string) {
  const termo = busca?.trim();

  return prisma.moto.findMany({
    where: {
      ativo: true,
      ...(termo
        ? {
            OR: [
              // busca pela placa já normalizada: o dono digita "abc-1d23" e
              // encontra o que está gravado como "ABC1D23"
              { placa: { contains: normalizarPlaca(termo) } },
              { modelo: { contains: termo, mode: "insensitive" } },
              { cliente: { nome: { contains: termo, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      cliente: { select: { id: true, nome: true } },
      _count: { select: { vendas: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function buscarMotoPorPlaca(placa: string) {
  return prisma.moto.findUnique({
    where: { placa: normalizarPlaca(placa) },
    include: { cliente: true },
  });
}

export async function criarMoto(dados: {
  placa: string;
  modelo?: string | null;
  clienteId?: string | null;
  observacoes?: string | null;
}) {
  const placa = validarPlaca(dados.placa);

  const existente = await prisma.moto.findUnique({ where: { placa } });
  if (existente) {
    throw new ErroMoto(`A placa ${formatarPlaca(placa)} já está cadastrada.`);
  }

  return prisma.moto.create({
    data: {
      placa,
      modelo: dados.modelo?.trim() || null,
      clienteId: dados.clienteId || null,
      observacoes: dados.observacoes?.trim() || null,
    },
  });
}

/**
 * Histórico da moto: tudo que já foi feito nela, do mais recente para o mais
 * antigo — peças trocadas e mão de obra executada.
 */
export async function historicoDaMoto(motoId: string) {
  return prisma.moto.findUnique({
    where: { id: motoId },
    include: {
      cliente: true,
      vendas: {
        orderBy: { dataHora: "desc" },
        include: {
          itens: { include: { produto: { select: { nome: true, marca: true } } } },
          servicos: { include: { repasses: { include: { mecanico: true } } } },
        },
      },
    },
  });
}
