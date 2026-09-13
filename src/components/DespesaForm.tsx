"use client";

import { useActionState } from "react";
import type { EstadoDespesa } from "@/app/despesas/actions";

type CategoriaOpcao = { id: string; nome: string };
type FornecedorOpcao = { id: string; nome: string };

type ValoresIniciais = {
  descricao: string;
  categoriaId: string;
  fornecedorId: string | null;
  valor: number;
  dataDespesa: Date;
  vencimento: Date | null;
  formaPagamento: string | null;
  classificacao: string;
  entraNoLucroLiquido: boolean;
  observacoes: string | null;
  comprovantePath: string | null;
};

const ESTADO_INICIAL: EstadoDespesa = {};

function paraInputDate(data: Date | null): string {
  if (!data) return "";
  return data.toISOString().slice(0, 10);
}

export function DespesaForm({
  action,
  categorias,
  fornecedores,
  valoresIniciais,
  ehEdicao = false,
}: {
  action: (estado: EstadoDespesa, formData: FormData) => Promise<EstadoDespesa>;
  categorias: CategoriaOpcao[];
  fornecedores: FornecedorOpcao[];
  valoresIniciais?: ValoresIniciais;
  ehEdicao?: boolean;
}) {
  const [estado, formAction, pendente] = useActionState(action, ESTADO_INICIAL);

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-6">
      <div>
        <label className="label" htmlFor="descricao">
          Descrição *
        </label>
        <input id="descricao" name="descricao" required defaultValue={valoresIniciais?.descricao} className="input" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="categoriaId">
            Categoria *
          </label>
          <select id="categoriaId" name="categoriaId" required defaultValue={valoresIniciais?.categoriaId ?? ""} className="input">
            <option value="" disabled>
              Selecione...
            </option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="fornecedorId">
            Fornecedor / beneficiário
          </label>
          <select id="fornecedorId" name="fornecedorId" defaultValue={valoresIniciais?.fornecedorId ?? ""} className="input">
            <option value="">Sem vínculo</option>
            {fornecedores.map((fornecedor) => (
              <option key={fornecedor.id} value={fornecedor.id}>
                {fornecedor.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="valor">
            Valor (R$) *
          </label>
          <input
            id="valor"
            name="valor"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={valoresIniciais ? valoresIniciais.valor / 100 : undefined}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="dataDespesa">
            Data da despesa *
          </label>
          <input
            id="dataDespesa"
            name="dataDespesa"
            type="date"
            required
            defaultValue={valoresIniciais ? paraInputDate(valoresIniciais.dataDespesa) : paraInputDate(new Date())}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="vencimento">
            Vencimento
          </label>
          <input
            id="vencimento"
            name="vencimento"
            type="date"
            defaultValue={valoresIniciais ? paraInputDate(valoresIniciais.vencimento) : undefined}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="formaPagamento">
            Forma de pagamento
          </label>
          <select id="formaPagamento" name="formaPagamento" defaultValue={valoresIniciais?.formaPagamento ?? ""} className="input">
            <option value="">Não definida</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="PIX">PIX</option>
            <option value="CARTAO_DEBITO">Cartão de débito</option>
            <option value="CARTAO_CREDITO">Cartão de crédito</option>
            <option value="BOLETO">Boleto</option>
            <option value="TRANSFERENCIA">Transferência</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="classificacao">
            Classificação *
          </label>
          <select id="classificacao" name="classificacao" required defaultValue={valoresIniciais?.classificacao ?? "OPERACIONAL"} className="input">
            <option value="FIXA">Fixa</option>
            <option value="VARIAVEL">Variável</option>
            <option value="ADMINISTRATIVA">Administrativa</option>
            <option value="COMERCIAL">Comercial</option>
            <option value="OPERACIONAL">Operacional</option>
            <option value="MARKETING">Marketing</option>
            <option value="EXCEPCIONAL">Excepcional</option>
          </select>
        </div>
        {!ehEdicao && (
          <div>
            <label className="label" htmlFor="recorrencia">
              Recorrência
            </label>
            <select id="recorrencia" name="recorrencia" defaultValue="NENHUMA" className="input">
              <option value="NENHUMA">Nenhuma</option>
              <option value="SEMANAL">Semanal</option>
              <option value="MENSAL">Mensal</option>
              <option value="TRIMESTRAL">Trimestral</option>
              <option value="SEMESTRAL">Semestral</option>
              <option value="ANUAL">Anual</option>
            </select>
          </div>
        )}
      </div>

      {ehEdicao && (
        <div>
          <label className="label" htmlFor="escopo">
            Aplicar edição em
          </label>
          <select id="escopo" name="escopo" defaultValue="somente_esta" className="input">
            <option value="somente_esta">Somente esta ocorrência</option>
            <option value="esta_e_futuras">Esta e as futuras ocorrências</option>
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="entraNoLucroLiquido"
          defaultChecked={valoresIniciais?.entraNoLucroLiquido ?? true}
        />
        Entra no cálculo do lucro líquido
      </label>

      <div>
        <label className="label" htmlFor="observacoes">
          Observações
        </label>
        <textarea id="observacoes" name="observacoes" rows={2} defaultValue={valoresIniciais?.observacoes ?? undefined} className="input" />
      </div>

      <div>
        <label className="label" htmlFor="comprovante">
          Comprovante / anexo
        </label>
        {valoresIniciais?.comprovantePath && (
          <a href={valoresIniciais.comprovantePath} target="_blank" rel="noopener noreferrer" className="mb-2 inline-block text-sm underline">
            Ver comprovante atual
          </a>
        )}
        <input id="comprovante" name="comprovante" type="file" accept="image/*,.pdf" className="input" />
      </div>

      {estado.erro && (
        <p className="badge badge-danger w-fit" role="alert">
          {estado.erro}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={pendente}>
        {pendente ? <span className="spinner" /> : "Salvar despesa"}
      </button>
    </form>
  );
}
