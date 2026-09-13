"use client";

import { useState } from "react";
import { centavosParaReais, reaisParaCentavos } from "@/lib/money";
import { divisaoPadrao, TOTAL_PONTOS_BASE, type BeneficiarioRepasse } from "@/lib/oficina/repasse";
import { criarTipoServicoAction, acharOuCriarMotoAction } from "@/app/vendas/oficinaActions";

/**
 * Mão de obra dentro da venda.
 *
 * Reúne o que o dono pediu num lugar só: escolher o mecânico, escolher (ou
 * criar) o tipo de serviço, digitar o valor, e a placa da moto — com a opção
 * de marcar "sem placa", porque nem toda moto que entra tem placa legível.
 *
 * A divisão vem preenchida pela regra da casa (sócio 50%, ou 100% se ele
 * executou sozinho) e fica visível e editável: o dono vê para onde vai o
 * dinheiro antes de fechar a venda, e pode ajustar.
 */

export type MecanicoOpcao = { id: string; nome: string; socioOficina: boolean };
export type TipoServicoOpcao = { id: string; nome: string };

export type ServicoLocal = {
  /** chave local só para o React; não vai para o servidor */
  chave: string;
  tipoServicoId: string | null;
  descricao: string;
  valorStr: string;
  executorId: string;
  beneficiarios: BeneficiarioRepasse[];
};

export type DadosMoto = { motoId: string | null; placaExibicao: string | null; semPlaca: boolean };

function novaChave() {
  return Math.random().toString(36).slice(2);
}

export function MaoDeObraVenda({
  mecanicos,
  tiposIniciais,
  servicos,
  onChange,
  moto,
  onMotoChange,
}: {
  mecanicos: MecanicoOpcao[];
  tiposIniciais: TipoServicoOpcao[];
  servicos: ServicoLocal[];
  onChange: (servicos: ServicoLocal[]) => void;
  moto: DadosMoto;
  onMotoChange: (moto: DadosMoto) => void;
}) {
  const [tipos, setTipos] = useState(tiposIniciais);
  const [novoTipo, setNovoTipo] = useState("");
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [placaStr, setPlacaStr] = useState("");
  const [erroMoto, setErroMoto] = useState<string | null>(null);
  const [buscandoMoto, setBuscandoMoto] = useState(false);
  const [erroTipo, setErroTipo] = useState<string | null>(null);

  const socio = mecanicos.find((m) => m.socioOficina) ?? null;

  function adicionarServico() {
    const executorId = socio?.id ?? mecanicos[0]?.id ?? "";
    onChange([
      ...servicos,
      {
        chave: novaChave(),
        tipoServicoId: null,
        descricao: "",
        valorStr: "",
        executorId,
        beneficiarios: divisaoPadrao({ executorId, socioId: socio?.id ?? null }),
      },
    ]);
  }

  function atualizar(chave: string, mudanca: Partial<ServicoLocal>) {
    onChange(servicos.map((s) => (s.chave === chave ? { ...s, ...mudanca } : s)));
  }

  /** Trocar o executor recalcula a divisão pela regra da casa. */
  function trocarExecutor(chave: string, executorId: string) {
    atualizar(chave, {
      executorId,
      beneficiarios: divisaoPadrao({ executorId, socioId: socio?.id ?? null }),
    });
  }

  function ajustarPercentual(chave: string, mecanicoId: string, percentualStr: string) {
    const servico = servicos.find((s) => s.chave === chave);
    if (!servico) return;

    const pontos = Math.round(Number(percentualStr.replace(",", ".")) * 100);
    if (!Number.isFinite(pontos)) return;

    const outros = servico.beneficiarios.filter((b) => b.mecanicoId !== mecanicoId);
    // Com dois beneficiários, mexer num percentual ajusta o outro sozinho —
    // senão a divisão não fecha 100% e a venda seria recusada no fim, depois
    // de todo o trabalho de preencher.
    if (outros.length === 1) {
      atualizar(chave, {
        beneficiarios: servico.beneficiarios.map((b) =>
          b.mecanicoId === mecanicoId
            ? { ...b, percentual: pontos }
            : { ...b, percentual: TOTAL_PONTOS_BASE - pontos }
        ),
      });
      return;
    }

    atualizar(chave, {
      beneficiarios: servico.beneficiarios.map((b) =>
        b.mecanicoId === mecanicoId ? { ...b, percentual: pontos } : b
      ),
    });
  }

  async function salvarNovoTipo() {
    const nome = novoTipo.trim();
    if (!nome) return;

    setCriandoTipo(true);
    setErroTipo(null);
    const r = await criarTipoServicoAction(nome);
    setCriandoTipo(false);

    if (!r.ok) {
      setErroTipo(r.erro);
      return;
    }
    if (!tipos.some((t) => t.id === r.tipo.id)) setTipos([...tipos, r.tipo].sort((a, b) => a.nome.localeCompare(b.nome)));
    setNovoTipo("");
  }

  async function confirmarPlaca() {
    const placa = placaStr.trim();
    if (!placa) return;

    setBuscandoMoto(true);
    setErroMoto(null);
    const r = await acharOuCriarMotoAction(placa);
    setBuscandoMoto(false);

    if (!r.ok) {
      setErroMoto(r.erro);
      return;
    }
    onMotoChange({ motoId: r.moto.id, placaExibicao: r.moto.placa, semPlaca: false });
  }

  const semMecanicos = mecanicos.length === 0;

  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="label">Mão de obra</p>
        <button
          type="button"
          className="btn btn-outline"
          onClick={adicionarServico}
          disabled={semMecanicos}
        >
          + Adicionar serviço
        </button>
      </div>

      {semMecanicos && (
        <p className="state-error" role="alert">
          Nenhum mecânico cadastrado. Cadastre o pessoal da oficina em Mão de
          obra para poder lançar serviço na venda.
        </p>
      )}

      {!semMecanicos && servicos.length === 0 && (
        <p className="ajuda">Venda só de peça? Pode deixar em branco.</p>
      )}

      {servicos.length > 0 && (
        <>
          {/* Placa: só aparece quando há serviço, porque venda de balcão não
              tem moto. "Sem placa" é opção de verdade — moto sem placa
              legível entra na oficina todo dia. */}
          <div className="bloco-moto">
            <p className="label-caps mb-2">Moto atendida</p>

            {moto.motoId ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="badge badge-accent">{moto.placaExibicao}</span>
                <button
                  type="button"
                  className="link-discreto"
                  onClick={() => {
                    onMotoChange({ motoId: null, placaExibicao: null, semPlaca: false });
                    setPlacaStr("");
                  }}
                >
                  trocar
                </button>
              </div>
            ) : moto.semPlaca ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="badge">Sem placa</span>
                <button
                  type="button"
                  className="link-discreto"
                  onClick={() => onMotoChange({ motoId: null, placaExibicao: null, semPlaca: false })}
                >
                  informar placa
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div style={{ flex: "1 1 180px" }}>
                  <input
                    className="input"
                    placeholder="ABC1D23"
                    value={placaStr}
                    onChange={(e) => setPlacaStr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmarPlaca();
                      }
                    }}
                    style={{ textTransform: "uppercase" }}
                    autoComplete="off"
                    aria-label="Placa da moto"
                  />
                </div>
                <button type="button" className="btn btn-outline" onClick={confirmarPlaca} disabled={buscandoMoto}>
                  {buscandoMoto ? <span className="spinner" /> : "Confirmar placa"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => onMotoChange({ motoId: null, placaExibicao: null, semPlaca: true })}
                >
                  Sem placa
                </button>
              </div>
            )}

            {erroMoto && (
              <p className="badge badge-danger mt-2" role="alert">
                {erroMoto}
              </p>
            )}
            {!moto.motoId && !moto.semPlaca && (
              <p className="ajuda">
                Se a moto já passou aqui, a placa encontra o histórico dela. Se
                for a primeira vez, é cadastrada agora.
              </p>
            )}
          </div>

          <ul className="flex flex-col gap-3">
            {servicos.map((servico) => {
              const valor = reaisParaCentavos(servico.valorStr || "0");
              return (
                <li key={servico.chave} className="linha-servico">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="label">Serviço</label>
                      <select
                        className="input"
                        value={servico.tipoServicoId ?? ""}
                        onChange={(e) => {
                          const id = e.target.value || null;
                          const tipo = tipos.find((t) => t.id === id);
                          atualizar(servico.chave, {
                            tipoServicoId: id,
                            descricao: tipo ? tipo.nome : servico.descricao,
                          });
                        }}
                      >
                        <option value="">Escolher...</option>
                        {tipos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                      {!servico.tipoServicoId && (
                        <input
                          className="input mt-2"
                          placeholder="ou descreva o serviço"
                          value={servico.descricao}
                          onChange={(e) => atualizar(servico.chave, { descricao: e.target.value })}
                        />
                      )}
                    </div>

                    <div>
                      <label className="label">Quem fez</label>
                      <select
                        className="input"
                        value={servico.executorId}
                        onChange={(e) => trocarExecutor(servico.chave, e.target.value)}
                      >
                        {mecanicos.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                            {m.socioOficina ? " (sócio)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Valor (R$)</label>
                      <input
                        className="input"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={servico.valorStr}
                        onChange={(e) => atualizar(servico.chave, { valorStr: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Para onde vai o dinheiro, à vista, antes de fechar. */}
                  <div className="divisao-servico">
                    <span className="label-caps">Divisão</span>
                    {servico.beneficiarios.map((b) => {
                      const mecanico = mecanicos.find((m) => m.id === b.mecanicoId);
                      const parte = Math.floor((valor * b.percentual) / TOTAL_PONTOS_BASE);
                      return (
                        <span key={b.mecanicoId} className="divisao-item">
                          <span>{mecanico?.nome ?? "?"}</span>
                          <input
                            className="input-percentual"
                            inputMode="decimal"
                            value={(b.percentual / 100).toString()}
                            onChange={(e) => ajustarPercentual(servico.chave, b.mecanicoId, e.target.value)}
                            aria-label={`Percentual de ${mecanico?.nome ?? ""}`}
                          />
                          <span>%</span>
                          <strong>{centavosParaReais(parte)}</strong>
                        </span>
                      );
                    })}
                    <button
                      type="button"
                      className="link-perigo"
                      onClick={() => onChange(servicos.filter((s) => s.chave !== servico.chave))}
                    >
                      Remover
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Cadastro de tipo novo sem sair da venda. */}
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div style={{ flex: "1 1 220px" }}>
              <label className="label">Novo tipo de serviço</label>
              <input
                className="input"
                placeholder="Ex.: Troca de relação"
                value={novoTipo}
                onChange={(e) => setNovoTipo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    salvarNovoTipo();
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={salvarNovoTipo}
              disabled={criandoTipo || !novoTipo.trim()}
            >
              {criandoTipo ? <span className="spinner" /> : "Cadastrar tipo"}
            </button>
          </div>
          {erroTipo && (
            <p className="badge badge-danger mt-2" role="alert">
              {erroTipo}
            </p>
          )}
        </>
      )}
    </section>
  );
}
