"use client";

import { useActionState, useState } from "react";
import type { EstadoProduto } from "@/app/produtos/actions";
import { conferirCodigoAction, type ResultadoConferencia } from "@/app/produtos/codigoBarras";
import { CampoCodigoBarras } from "./CampoCodigoBarras";
import { nicho, rotuloMedida, usaVendaFracionada } from "@/config/nicho";

type FornecedorOpcao = { id: string; nome: string };

type ValoresIniciais = {
  nome: string;
  marca: string;
  categoria: string;
  medida: number | null;
  sku: string;
  codigoBarras: string | null;
  precoCustoRef: number;
  precoVenda: number;
  fornecedorId: string | null;
  atributoA: string | null;
  atributoB: string | null;
  tipoVenda: string;
  estoqueMinimo: number;
  fotoPath: string | null;
};

const ESTADO_INICIAL: EstadoProduto = {};

export function ProdutoForm({
  action,
  fornecedores,
  valoresIniciais,
  tipoVendaBloqueado = false,
  podeVerCustos = true,
  codigoInicial,
  produtoIdAtual,
}: {
  action: (estado: EstadoProduto, formData: FormData) => Promise<EstadoProduto>;
  fornecedores: FornecedorOpcao[];
  valoresIniciais?: ValoresIniciais;
  tipoVendaBloqueado?: boolean;
  podeVerCustos?: boolean;
  /** Código bipado na venda, quando a peça não existia e o dono veio cadastrar. */
  codigoInicial?: string;
  /** Na edição, o próprio código da peça não conta como conflito. */
  produtoIdAtual?: string;
}) {
  const [estado, formAction, pendente] = useActionState(action, ESTADO_INICIAL);
  const [conferencia, setConferencia] = useState<ResultadoConferencia | null>(null);

  // Bipou no cadastro: antes de deixar salvar, diz se esse código já é de
  // outra peça. Sem isso o dono só descobre no "não foi possível salvar",
  // depois de ter digitado a ficha inteira.
  async function conferirCodigo(codigo: string) {
    setConferencia(await conferirCodigoAction(codigo, produtoIdAtual));
  }

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nome">
            Nome *
          </label>
          <input
            id="nome"
            name="nome"
            required
            defaultValue={valoresIniciais?.nome}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="marca">
            {nicho.termos.marca} *
          </label>
          <input
            id="marca"
            name="marca"
            required
            defaultValue={valoresIniciais?.marca}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="categoria">
            {nicho.termos.categoria} *
          </label>
          <input
            id="categoria"
            name="categoria"
            required
            defaultValue={valoresIniciais?.categoria}
            className="input"
            placeholder={nicho.categoriasProdutoIniciais.slice(0, 2).join(", ")}
          />
        </div>
        {nicho.atributos.medida.ativo && (
          <div>
            <label className="label" htmlFor="medida">
              {rotuloMedida()}
            </label>
            <input
              id="medida"
              name="medida"
              type="number"
              min={0}
              defaultValue={valoresIniciais?.medida ?? undefined}
              className="input"
            />
            {nicho.atributos.medida.ajuda && (
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                {nicho.atributos.medida.ajuda}
              </p>
            )}
          </div>
        )}
        {nicho.atributos.atributoA.ativo && (
          <div>
            <label className="label" htmlFor="atributoA">
              {nicho.atributos.atributoA.rotulo}
            </label>
            {nicho.atributos.atributoA.opcoes.length > 0 ? (
              <select id="atributoA" name="atributoA" defaultValue={valoresIniciais?.atributoA ?? ""} className="input">
                <option value="">Não informado</option>
                {nicho.atributos.atributoA.opcoes.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="atributoA"
                name="atributoA"
                defaultValue={valoresIniciais?.atributoA ?? undefined}
                className="input"
              />
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="sku">
            Código
          </label>
          <input
            id="sku"
            name="sku"
            defaultValue={valoresIniciais?.sku}
            className="input"
          />
          {/* Deixou de ser obrigatório: o lançamento de pedido já gera o código
              sozinho, e exigir aqui obrigava o dono a inventar um no balcão —
              justamente o atrito que fazia o cadastro não acontecer. */}
          <p className="ajuda">Deixe em branco para o sistema gerar.</p>
        </div>
        <CampoCodigoBarras
          nome="codigoBarras"
          valorInicial={valoresIniciais?.codigoBarras ?? codigoInicial ?? ""}
          limparAposBipar={false}
          focoAutomatico={!!codigoInicial}
          rotulo="Código de barras"
          ajuda="Bipe a embalagem com o leitor, ou deixe em branco."
          aoBipar={conferirCodigo}
        >
          {conferencia?.status === "em_uso" && (
            <div className="bipe-resposta bipe-resposta-aviso">
              <span>
                Esse código já é de <strong>{conferencia.nome}</strong>
                {!conferencia.ativo && " (arquivada)"}.
              </span>
              <a className="btn btn-outline" href={`/produtos/${conferencia.produtoId}`}>
                Abrir essa {nicho.termos.produto.singular.toLowerCase()}
              </a>
            </div>
          )}
          {conferencia?.status === "livre" && (
            <div className="bipe-resposta bipe-resposta-ok">Código livre.</div>
          )}
          {conferencia?.status === "erro" && (
            <div className="bipe-resposta bipe-resposta-aviso">{conferencia.mensagem}</div>
          )}
        </CampoCodigoBarras>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {podeVerCustos ? (
          <div>
            <label className="label" htmlFor="precoCustoRef">
              Preço de custo (R$)
            </label>
            <input
              id="precoCustoRef"
              name="precoCustoRef"
              type="number"
              step="0.01"
              min={0}
              defaultValue={valoresIniciais ? valoresIniciais.precoCustoRef / 100 : undefined}
              className="input"
            />
          </div>
        ) : (
          <input type="hidden" name="precoCustoRef" value={valoresIniciais?.precoCustoRef ? valoresIniciais.precoCustoRef / 100 : 0} />
        )}
        <div>
          <label className="label" htmlFor="precoVenda">
            Preço de venda (R$) *
          </label>
          <input
            id="precoVenda"
            name="precoVenda"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={valoresIniciais ? valoresIniciais.precoVenda / 100 : undefined}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {nicho.atributos.atributoB.ativo && (
          <div>
            <label className="label" htmlFor="atributoB">
              {nicho.atributos.atributoB.rotulo}
            </label>
            {nicho.atributos.atributoB.opcoes.length > 0 ? (
              <select id="atributoB" name="atributoB" defaultValue={valoresIniciais?.atributoB ?? ""} className="input">
                <option value="">Não informado</option>
                {nicho.atributos.atributoB.opcoes.map((opcao) => (
                  <option key={opcao.valor} value={opcao.valor}>
                    {opcao.rotulo}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="atributoB"
                name="atributoB"
                defaultValue={valoresIniciais?.atributoB ?? undefined}
                className="input"
              />
            )}
          </div>
        )}
        {/* Venda fracionada desligada no nicho = o campo não existe. Mostrá-lo
            oferecia uma opção que o resto do sistema não suporta, e o dono não
            tinha como saber disso. O valor vai fixo como unidade. */}
        {!usaVendaFracionada ? (
          <input type="hidden" name="tipoVenda" value="UNIDADE" />
        ) : (
        <div>
          <label className="label" htmlFor="tipoVenda">
            Tipo de venda
          </label>
          {tipoVendaBloqueado ? (
            <>
              <select id="tipoVenda" disabled defaultValue={valoresIniciais?.tipoVenda ?? "UNIDADE"} className="input">
                <option value="UNIDADE">Unidade fechada</option>
                <option value="FRACIONADO">{nicho.estoque.vendaFracionada.rotulo}</option>
              </select>
              <input type="hidden" name="tipoVenda" value={valoresIniciais?.tipoVenda ?? "UNIDADE"} />
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Não pode ser alterado — este produto já tem lotes de estoque registrados.
              </p>
            </>
          ) : (
            <select
              id="tipoVenda"
              name="tipoVenda"
              defaultValue={valoresIniciais?.tipoVenda ?? "UNIDADE"}
              className="input"
            >
              <option value="UNIDADE">Unidade fechada</option>
              <option value="FRACIONADO">{nicho.estoque.vendaFracionada.rotulo}</option>
            </select>
          )}
        </div>
        )}
        <div>
          <label className="label" htmlFor="estoqueMinimo">
            Estoque mínimo
          </label>
          <input
            id="estoqueMinimo"
            name="estoqueMinimo"
            type="number"
            min={0}
            defaultValue={valoresIniciais?.estoqueMinimo ?? 0}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="fornecedorId">
          {nicho.termos.fornecedor.singular}
        </label>
        <select
          id="fornecedorId"
          name="fornecedorId"
          defaultValue={valoresIniciais?.fornecedorId ?? ""}
          className="input"
        >
          <option value="">Sem {nicho.termos.fornecedor.singular.toLowerCase()} vinculado</option>
          {fornecedores.map((fornecedor) => (
            <option key={fornecedor.id} value={fornecedor.id}>
              {fornecedor.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="foto">
          Foto da {nicho.termos.produto.singular.toLowerCase()}
        </label>
        {valoresIniciais?.fotoPath && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={valoresIniciais.fotoPath}
            alt={`Foto atual da ${nicho.termos.produto.singular.toLowerCase()}`}
            className="mb-2 h-24 w-24 rounded-lg object-cover"
          />
        )}
        <input id="foto" name="foto" type="file" accept="image/*" className="input" />
      </div>

      {estado.erro && (
        <p className="badge badge-danger w-fit" role="alert">
          {estado.erro}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={pendente}>
        {pendente ? <span className="spinner" /> : `Salvar ${nicho.termos.produto.singular.toLowerCase()}`}
      </button>
    </form>
  );
}
