import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { resumoDashboard } from "@/lib/dashboard";
import { resumoRepasses } from "@/lib/oficina/consultas";
import { centavosParaReais } from "@/lib/money";
import { podeLer, type Recurso } from "@/lib/permissoes";
import { nicho } from "@/config/nicho";
import type { SessaoUsuario } from "@/lib/types";
import {
  IconVender,
  IconProdutos,
  IconEstoque,
  IconEntradaEstoque,
  IconClientes,
  IconMoto,
  IconRepasse,
  IconDespesas,
  IconRelatorios,
  IconFornecedores,
  IconCompras,
  IconDinheiro,
  IconUsuarios,
  IconAuditoria,
  IconChat,
  IconFrete,
} from "@/components/icons";

/**
 * Tela inicial — e, desde que o menu lateral saiu, a ÚNICA porta de entrada
 * para o resto do sistema.
 *
 * Consequência prática: toda tela precisa aparecer em algum atalho daqui.
 * Se você criar uma página nova e esquecer de listá-la, ela fica inalcançável
 * — não existe mais menu para socorrer.
 *
 * A divisão em dois blocos é o que mantém a tela simples sem esconder nada:
 * em cima o que se usa no balcão todo dia, embaixo o que o dono abre de vez
 * em quando.
 */

type Item = {
  href: string;
  icone: ReactNode;
  titulo: string;
  ajuda?: string;
  /** Sem recurso = visível para qualquer usuário logado. */
  recurso?: Recurso;
  /** Telas de configuração do sistema, só para o dono. */
  somenteDono?: boolean;
  principal?: boolean;
};

function primeiroNome(nomeCompleto: string): string {
  const limpo = nomeCompleto.trim();
  if (!limpo) return "";
  return limpo.split(/\s+/)[0];
}

function saudacaoPorHora(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function podeVer(usuario: SessaoUsuario, item: Item): boolean {
  if (item.somenteDono && usuario.papel !== "OWNER") return false;
  if (item.recurso && !podeLer(usuario, item.recurso)) return false;
  return true;
}

const TAMANHO_ICONE = { width: 22, height: 22 };
const TAMANHO_ICONE_MINI = { width: 17, height: 17 };

const DIA_A_DIA: Item[] = [
  {
    href: "/vendas/nova",
    icone: <IconVender {...TAMANHO_ICONE} />,
    titulo: "Nova venda",
    ajuda: "Vender peça e lançar mão de obra",
    recurso: "vendas",
    principal: true,
  },
  {
    href: "/produtos",
    icone: <IconProdutos {...TAMANHO_ICONE} />,
    titulo: nicho.termos.produto.plural,
    ajuda: "Cadastro, preço e busca",
    recurso: "produtos",
  },
  {
    href: "/estoque/entrada-estoque",
    icone: <IconEntradaEstoque {...TAMANHO_ICONE} />,
    titulo: "Entrada de peça",
    ajuda: "Chegou mercadoria do fornecedor",
    recurso: "estoque",
  },
  {
    href: "/estoque",
    icone: <IconEstoque {...TAMANHO_ICONE} />,
    titulo: "Estoque",
    ajuda: "O que tem e o que está acabando",
    recurso: "estoque",
  },
  {
    href: "/vendas",
    icone: <IconDinheiro {...TAMANHO_ICONE} />,
    titulo: "Vendas",
    ajuda: "Tudo que já foi vendido",
    recurso: "vendas",
  },
  {
    href: "/clientes",
    icone: <IconClientes {...TAMANHO_ICONE} />,
    titulo: "Clientes",
    ajuda: "Cadastro e histórico",
    recurso: "clientes",
  },
  {
    href: "/motos",
    icone: <IconMoto {...TAMANHO_ICONE} />,
    titulo: "Motos",
    ajuda: "Histórico por placa",
    recurso: "motos",
  },
  {
    href: "/oficina/mecanicos",
    icone: <IconRepasse {...TAMANHO_ICONE} />,
    titulo: "Mão de obra",
    ajuda: "Mecânicos e quanto têm a receber",
    recurso: "oficina",
  },
  {
    href: "/despesas",
    icone: <IconDespesas {...TAMANHO_ICONE} />,
    titulo: "Despesas",
    ajuda: "Contas da loja",
    recurso: "despesas",
  },
];

const GESTAO: Item[] = [
  {
    href: "/relatorios",
    icone: <IconRelatorios {...TAMANHO_ICONE_MINI} />,
    titulo: "Relatórios",
    recurso: "relatorios",
  },
  {
    href: "/clientes/debitos",
    icone: <IconDinheiro {...TAMANHO_ICONE_MINI} />,
    titulo: "Quem está devendo",
    recurso: "clientes",
  },
  {
    href: "/fornecedores",
    icone: <IconFornecedores {...TAMANHO_ICONE_MINI} />,
    titulo: nicho.termos.fornecedor.plural,
    recurso: "fornecedores",
  },
  {
    href: "/compras",
    icone: <IconCompras {...TAMANHO_ICONE_MINI} />,
    titulo: "Pedidos de compra",
    recurso: "compras",
  },
  {
    href: "/fretes",
    icone: <IconFrete {...TAMANHO_ICONE_MINI} />,
    titulo: "Cotador de fretes",
    recurso: "fretes",
  },
  {
    href: "/usuarios",
    icone: <IconUsuarios {...TAMANHO_ICONE_MINI} />,
    titulo: "Usuários",
    somenteDono: true,
  },
  {
    href: "/auditoria",
    icone: <IconAuditoria {...TAMANHO_ICONE_MINI} />,
    titulo: "Auditoria",
    somenteDono: true,
  },
  {
    href: "/assistente/configuracoes",
    icone: <IconChat {...TAMANHO_ICONE_MINI} />,
    titulo: "Assistente de IA",
    somenteDono: true,
  },
];

function Resumo({
  rotulo,
  valor,
  href,
  alerta,
}: {
  rotulo: string;
  valor: string;
  href?: string;
  alerta?: boolean;
}) {
  const conteudo = (
    <>
      <p className="resumo-rotulo">{rotulo}</p>
      <p className={`resumo-valor${alerta ? " resumo-valor-alerta" : ""}`}>{valor}</p>
    </>
  );

  return href ? (
    <Link href={href} className="resumo-card">
      {conteudo}
    </Link>
  ) : (
    <div className="resumo-card">{conteudo}</div>
  );
}

function Atalho({ item }: { item: Item }) {
  return (
    <Link href={item.href} className={`atalho${item.principal ? " atalho-principal" : ""}`}>
      <span className="atalho-bolha" aria-hidden="true">
        {item.icone}
      </span>
      <span>
        <span className="atalho-titulo">{item.titulo}</span>
        {item.ajuda && <span className="atalho-ajuda block">{item.ajuda}</span>}
      </span>
    </Link>
  );
}

function AtalhoMini({ item }: { item: Item }) {
  return (
    <Link href={item.href} className="atalho-mini">
      <span className="atalho-mini-bolha" aria-hidden="true">
        {item.icone}
      </span>
      <span>{item.titulo}</span>
    </Link>
  );
}

export default async function DashboardPage() {
  const usuario = await requireUser();
  const [dados, repasses] = await Promise.all([resumoDashboard(), resumoRepasses()]);

  const agora = new Date();
  const dataPorExtenso = agora.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const diaADia = DIA_A_DIA.filter((item) => podeVer(usuario, item));
  const gestao = GESTAO.filter((item) => podeVer(usuario, item));

  return (
    <AppShell usuario={usuario} wide>
      <section className="home-hero">
        <div className="home-hero-conteudo">
          <p className="home-saudacao">
            {saudacaoPorHora(agora.getHours())} — bem-vindo de volta
          </p>
          <h1 className="home-nome texto-cromado">{primeiroNome(usuario.nome)}</h1>
          <div className="home-filete" />
          <div className="home-hero-rodape">
            <span>{dataPorExtenso}</span>
            <span aria-hidden="true">·</span>
            <span>{nicho.negocio.nome}</span>
          </div>
        </div>
      </section>

      <section className="resumo-grid">
        <Resumo
          rotulo="Faturamento hoje"
          valor={centavosParaReais(dados.faturamentoDia.totalCentavos)}
          href="/vendas/historico?periodo=dia"
        />
        <Resumo
          rotulo="Vendas hoje"
          valor={String(dados.faturamentoDia.quantidadeVendas)}
          href="/vendas/historico?periodo=dia"
        />
        <Resumo
          rotulo="Faturamento no mês"
          valor={centavosParaReais(dados.faturamentoMes.totalCentavos)}
          href="/vendas/historico?periodo=mes"
        />
        {/* Mão de obra não é lucro da loja — é dinheiro do pessoal da oficina.
            Fica em vermelho justamente para não ser lido como resultado. */}
        <Resumo
          rotulo="Mão de obra a pagar"
          valor={centavosParaReais(repasses.aPagarCentavos)}
          href="/oficina/mecanicos"
          alerta={repasses.aPagarCentavos > 0}
        />
      </section>

      <section>
        <h2 className="label-caps mb-3">O que você quer fazer</h2>
        <div className="atalho-grid">
          {diaADia.map((item) => (
            <Atalho key={item.href} item={item} />
          ))}
        </div>
      </section>

      {gestao.length > 0 && (
        <section className="home-secao">
          <h2 className="label-caps mb-3">Gestão e cadastros</h2>
          <div className="atalho-mini-grid">
            {gestao.map((item) => (
              <AtalhoMini key={item.href} item={item} />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
