import type { SessaoUsuario } from "@/lib/types";
import { melhorEnvioConfig, type AmbienteMelhorEnvio } from "./config";
import { chamarMelhorEnvio, ErroMelhorEnvio } from "./client";
import { obterTokenValido } from "./oauth";
import {
  validarDadosCotacao,
  normalizarResposta,
  limparCep,
  paraReaisDecimal,
  type DadosCotacao,
  type ResultadoCotacao,
  type RespostaCalculoItem,
} from "./normalizacao";

export type { DadosCotacao, OpcaoFrete, ServicoIndisponivel, ResultadoCotacao, OrdenacaoCotacao } from "./normalizacao";
export { validarDadosCotacao, ordenarOpcoes, limparCep } from "./normalizacao";

export async function cotarFrete(
  dados: DadosCotacao,
  usuario: SessaoUsuario,
  ambiente: AmbienteMelhorEnvio = melhorEnvioConfig.environment
): Promise<ResultadoCotacao> {
  const erros = validarDadosCotacao(dados);
  if (erros.length > 0) {
    throw new ErroMelhorEnvio("DADOS_INVALIDOS", erros.join(" "));
  }

  const token = await obterTokenValido(usuario, ambiente);

  const corpo = {
    from: { postal_code: limparCep(dados.cepOrigem) },
    to: { postal_code: limparCep(dados.cepDestino) },
    package: {
      height: dados.alturaCm,
      width: dados.larguraCm,
      length: dados.comprimentoCm,
      weight: dados.pesoKg,
    },
    options: {
      insurance_value: dados.valorDeclaradoCentavos ? paraReaisDecimal(dados.valorDeclaradoCentavos) : 0,
      receipt: false,
      own_hand: false,
    },
  };

  const resposta = await chamarMelhorEnvio<RespostaCalculoItem[]>(ambiente, "/api/v2/me/shipment/calculate", {
    metodo: "POST",
    token,
    corpo,
  });

  return normalizarResposta(Array.isArray(resposta) ? resposta : []);
}
