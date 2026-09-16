"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProdutoAutocomplete, type ProdutoBusca } from "@/components/ProdutoAutocomplete";
import { CampoCodigoBarras } from "@/components/CampoCodigoBarras";
import { biparParaEntradaAction } from "@/app/produtos/codigoBarras";
import {
  ajustarEstoquePorProdutoAction,
  transferirDemonstracaoPorProdutoAction,
  registrarSaidaDemonstracaoPorProdutoAction,
} from "./actions";
import { nicho, usaDemonstracao, usaValidade, rotuloDemonstracao } from "@/config/nicho";

/**
 * Corrigir o estoque de uma peça para mais ou para menos.
 *
 * A tela nasceu no molde universal, que atende nicho com mostruário e com
 * validade. Aqui não existe nem um nem outro (ver src/config/nicho.ts), e as
 * opções herdadas — "pool demonstração", "baixa por vencimento" — faziam a
 * tela parecer não servir para o que o dono queria: tirar peça do estoque.
 * Por isso tudo o que o nicho desliga some daqui.
 */

type Modo = "ajuste" | "transferencia" | "saida_demonstracao";
type Sentido = "diminuir" | "aumentar";

type TipoAjuste = "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO" | "PERDA_VENCIMENTO" | "PERDA_DEFEITO" | "BRINDE";

/** Motivos de tirar peça, nas palavras de quem está no balcão. */
const MOTIVOS_DIMINUIR: Array<{ valor: TipoAjuste; rotulo: string; exigeValidade?: boolean }> = [
  { valor: "AJUSTE_NEGATIVO", rotulo: "Faltou na contagem (tinha menos do que o sistema dizia)" },
  { valor: "PERDA_DEFEITO", rotulo: "Peça com defeito / quebrada" },
  { valor: "BRINDE", rotulo: "Dei de brinde / cortesia" },
  { valor: "PERDA_VENCIMENTO", rotulo: "Venceu", exigeValidade: true },
];

export function AjusteForm({ produtoInicial }: { produtoInicial?: ProdutoBusca }) {
  const router = useRouter();
  const [pendente, iniciarTransicao] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const [produto, setProduto] = useState<ProdutoBusca | undefined>(produtoInicial);
  const [modo, setModo] = useState<Modo>("ajuste");

  const [sentido, setSentido] = useState<Sentido>("diminuir");
  const [tipoDiminuir, setTipoDiminuir] = useState<TipoAjuste>("AJUSTE_NEGATIVO");
  const [poolAjuste, setPoolAjuste] = useState<"VENDA" | "DEMONSTRACAO">("VENDA");
  const [motivo, setMotivo] = useState("");

  const [sentidoTransferencia, setSentidoTransferencia] = useState<
    "VENDA_PARA_DEMONSTRACAO" | "DEMONSTRACAO_PARA_VENDA"
  >("VENDA_PARA_DEMONSTRACAO");

  const [quantidade, setQuantidade] = useState("");

  const unidade = produto?.tipoVenda === "FRACIONADO" ? "ml" : "un.";
  const motivosDisponiveis = MOTIVOS_DIMINUIR.filter((m) => !m.exigeValidade || usaValidade);

  async function biparProduto(codigo: string) {
    setMensagem(null);
    const resultado = await biparParaEntradaAction(codigo);
    if (resultado.ok) {
      setProduto(resultado.produto);
      return;
    }
    setMensagem(resultado.mensagem);
  }

  function confirmar() {
    if (!produto) {
      setMensagem(`Selecione a ${nicho.termos.produto.singular.toLowerCase()}.`);
      return;
    }
    const qtd = Number(quantidade) || 0;
    if (qtd <= 0) {
      setMensagem("Informe uma quantidade válida.");
      return;
    }
    if (modo !== "transferencia" && !motivo.trim()) {
      setMensagem("Escreva o motivo — é o que explica a diferença depois.");
      return;
    }

    setMensagem(null);
    setSucesso(null);
    iniciarTransicao(async () => {
      const resultado =
        modo === "ajuste"
          ? await ajustarEstoquePorProdutoAction({
              produtoId: produto.id,
              pool: poolAjuste,
              tipo: sentido === "aumentar" ? "AJUSTE_POSITIVO" : tipoDiminuir,
              quantidade: qtd,
              motivo,
            })
          : modo === "transferencia"
            ? await transferirDemonstracaoPorProdutoAction({
                produtoId: produto.id,
                sentido: sentidoTransferencia,
                quantidade: qtd,
              })
            : await registrarSaidaDemonstracaoPorProdutoAction({ produtoId: produto.id, quantidade: qtd, motivo });

      if (!resultado.ok) {
        setMensagem(resultado.erro);
        return;
      }
      setQuantidade("");
      setMotivo("");
      setSucesso(
        sentido === "aumentar"
          ? `Estoque aumentado em ${qtd} ${unidade}.`
          : `Baixa de ${qtd} ${unidade} registrada.`
      );
      router.refresh();
    });
  }

  return (
    <div className="card flex flex-col gap-4 p-6">
      <div>
        <label className="label">{nicho.termos.produto.singular} *</label>
        {produto ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
            <span className="min-w-0">
              <span className="font-medium">{produto.nome}</span>{" "}
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {produto.marca} · {produto.sku}
              </span>
            </span>
            <button type="button" className="btn btn-outline shrink-0" onClick={() => setProduto(undefined)}>
              Trocar
            </button>
          </div>
        ) : (
          <>
            {/* Bipar também aqui: a peça quebrada está na mão dele. */}
            <CampoCodigoBarras aoBipar={biparProduto} rotulo="Bipe a peça" focoAutomatico />
            <p className="ajuda mt-2">ou busque pelo nome:</p>
            <ProdutoAutocomplete onSelecionar={setProduto} />
          </>
        )}
      </div>

      {/* Só aparece onde mostruário existe. Nesta loja, não existe — e a lista
          de opções do molde era o que fazia a tela parecer outra coisa. */}
      {usaDemonstracao && (
        <div>
          <label className="label">Tipo de operação</label>
          <select className="input" value={modo} onChange={(evento) => setModo(evento.target.value as Modo)}>
            <option value="ajuste">Corrigir estoque (baixa ou sobra)</option>
            <option value="transferencia">Transferência venda ↔ {rotuloDemonstracao.toLowerCase()}</option>
            <option value="saida_demonstracao">Saída de {rotuloDemonstracao.toLowerCase()} (uso/descarte)</option>
          </select>
        </div>
      )}

      {modo === "ajuste" && (
        <>
          <div>
            <label className="label">O que aconteceu *</label>
            {/* Diminuir vem primeiro e já selecionado: é o caso do dia a dia —
                peça que quebrou, sumiu ou saiu sem passar pela venda. */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`chip ${sentido === "diminuir" ? "chip-selected" : ""}`}
                onClick={() => setSentido("diminuir")}
              >
                − Diminuir estoque
              </button>
              <button
                type="button"
                className={`chip ${sentido === "aumentar" ? "chip-selected" : ""}`}
                onClick={() => setSentido("aumentar")}
              >
                + Aumentar estoque
              </button>
            </div>
          </div>

          {sentido === "diminuir" && (
            <div>
              <label className="label" htmlFor="tipo-baixa">
                Motivo da baixa
              </label>
              <select
                id="tipo-baixa"
                className="input"
                value={tipoDiminuir}
                onChange={(evento) => setTipoDiminuir(evento.target.value as TipoAjuste)}
              >
                {motivosDisponiveis.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </div>
          )}

          {usaDemonstracao && (
            <div>
              <label className="label">De onde</label>
              <select
                className="input"
                value={poolAjuste}
                onChange={(evento) => setPoolAjuste(evento.target.value as typeof poolAjuste)}
              >
                <option value="VENDA">Estoque de venda</option>
                <option value="DEMONSTRACAO">{rotuloDemonstracao}</option>
              </select>
            </div>
          )}
        </>
      )}

      {modo === "transferencia" && usaDemonstracao && (
        <select
          className="input"
          value={sentidoTransferencia}
          onChange={(evento) => setSentidoTransferencia(evento.target.value as typeof sentidoTransferencia)}
        >
          <option value="VENDA_PARA_DEMONSTRACAO">Venda → {rotuloDemonstracao}</option>
          <option value="DEMONSTRACAO_PARA_VENDA">{rotuloDemonstracao} → Venda</option>
        </select>
      )}

      <div>
        <label className="label" htmlFor="quantidade">
          Quantas {unidade} *
        </label>
        <input
          id="quantidade"
          type="number"
          min={1}
          className="input"
          value={quantidade}
          onChange={(evento) => setQuantidade(evento.target.value)}
        />
      </div>

      {modo !== "transferencia" && (
        <div>
          <label className="label" htmlFor="motivo">
            Explique em poucas palavras *
          </label>
          <textarea
            id="motivo"
            className="input"
            rows={2}
            placeholder="Ex.: caiu e quebrou no balcão"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />
          <p className="ajuda">Fica registrado — é assim que você entende a diferença quando conferir depois.</p>
        </div>
      )}

      {mensagem && (
        <p className="state-error" role="alert">
          {mensagem}
        </p>
      )}
      {sucesso && !mensagem && (
        <p className="badge badge-success w-fit" role="status">
          {sucesso}
        </p>
      )}

      <button type="button" className="btn btn-primary btn-block btn-lg" disabled={pendente || !produto} onClick={confirmar}>
        {pendente ? <span className="spinner" /> : sentido === "aumentar" ? "Aumentar estoque" : "Dar baixa"}
      </button>
    </div>
  );
}
