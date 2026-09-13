"use client";

import { useState, useTransition } from "react";
import { centavosParaReais } from "@/lib/money";
import {
  renomearMecanicoAction,
  alterarAtivoMecanicoAction,
  definirSocioAction,
  excluirMecanicoAction,
} from "./actions";

/**
 * Uma linha do cadastro de mecânicos, com tudo que o dono administra:
 * renomear, marcar/desmarcar sócio, arquivar e excluir.
 *
 * Excluir só aparece para quem nunca teve mão de obra lançada. Quem já tem
 * histórico de dinheiro só pode ser arquivado — apagar arrancaria o nome de
 * serviços já registrados. Em vez de mostrar um botão que sempre dá erro,
 * a tela mostra a opção certa para cada caso.
 */

export type MecanicoLinhaProps = {
  id: string;
  nome: string;
  socioOficina: boolean;
  ativo: boolean;
  temHistorico: boolean;
  pendenteCentavos: number;
  aPagarCentavos: number;
};

export function MecanicoLinha({ mecanico }: { mecanico: MecanicoLinhaProps }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(mecanico.nome);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();

  function rodar(acao: () => Promise<{ ok: true } | { ok: false; erro: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) setErro(r.erro);
      else {
        setEditando(false);
        setConfirmandoExclusao(false);
      }
    });
  }

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editando ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input"
                style={{ maxWidth: 240 }}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                aria-label={`Nome de ${mecanico.nome}`}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={ocupado}
                onClick={() => rodar(() => renomearMecanicoAction(mecanico.id, nome))}
              >
                Salvar
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={ocupado}
                onClick={() => {
                  setNome(mecanico.nome);
                  setEditando(false);
                  setErro(null);
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <span className="font-medium">{mecanico.nome}</span>
              {mecanico.socioOficina && <span className="badge badge-accent ml-2">Sócio</span>}
              {!mecanico.ativo && <span className="badge ml-2">Arquivado</span>}
            </>
          )}
        </div>

        <span className="flex flex-wrap gap-4 text-sm">
          <span>
            <span className="label-caps block">A pagar</span>
            <span className="font-semibold" style={{ color: "var(--accent)" }}>
              {centavosParaReais(mecanico.aPagarCentavos)}
            </span>
          </span>
          <span>
            <span className="label-caps block">Aguardando cliente</span>
            <span style={{ color: "var(--muted)" }}>
              {centavosParaReais(mecanico.pendenteCentavos)}
            </span>
          </span>
        </span>
      </div>

      {!editando && (
        <div className="acoes-linha">
          <button type="button" disabled={ocupado} onClick={() => setEditando(true)}>
            Renomear
          </button>

          <button
            type="button"
            disabled={ocupado}
            onClick={() => rodar(() => definirSocioAction(mecanico.id, !mecanico.socioOficina))}
          >
            {mecanico.socioOficina ? "Deixar de ser sócio" : "Marcar como sócio"}
          </button>

          <button
            type="button"
            disabled={ocupado}
            onClick={() => rodar(() => alterarAtivoMecanicoAction(mecanico.id, !mecanico.ativo))}
          >
            {mecanico.ativo ? "Arquivar" : "Reativar"}
          </button>

          {/* Excluir de verdade só para quem nunca teve repasse. */}
          {!mecanico.temHistorico &&
            (confirmandoExclusao ? (
              <>
                <span className="acoes-linha-aviso">Excluir {mecanico.nome}?</span>
                <button
                  type="button"
                  className="acao-perigo"
                  disabled={ocupado}
                  onClick={() => rodar(() => excluirMecanicoAction(mecanico.id))}
                >
                  Sim, excluir
                </button>
                <button type="button" disabled={ocupado} onClick={() => setConfirmandoExclusao(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                className="acao-perigo"
                disabled={ocupado}
                onClick={() => setConfirmandoExclusao(true)}
              >
                Excluir
              </button>
            ))}
        </div>
      )}

      {erro && (
        <p className="badge badge-danger mt-3" role="alert">
          {erro}
        </p>
      )}
    </li>
  );
}
