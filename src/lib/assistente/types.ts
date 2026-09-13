import type { Recurso } from "@/lib/permissoes";
import type { SessaoUsuario } from "@/lib/types";

// Estados explícitos da UI — o usuário nunca deve ficar sem saber o que
// está acontecendo. Áudio (Fase 3) estende este union, não substitui.
export type EstadoConversa =
  | "ocioso"
  | "enviando"
  | "interpretando"
  | "buscando_dados"
  | "concluido"
  | "erro";

export type ToolResultadoSucesso = {
  success: true;
  data: unknown;
  message: string;
  warnings?: string[];
};

export type ToolResultadoErro = {
  success: false;
  error_code: string;
  message: string;
  details?: unknown;
};

export type ToolResultado = ToolResultadoSucesso | ToolResultadoErro;

// Nível de confirmação da ferramenta — Fase 1 só tem Nível 1 (consulta).
// Os níveis 2/3 já entram no tipo para não exigir retrabalho na Fase 2/4.
export type NivelConfirmacao = 1 | 2 | 3;

export type FerramentaAssistente = {
  nome: string;
  descricao: string;
  recurso: Recurso;
  nivel: NivelConfirmacao;
  // true = precisa podeEscrever, false = basta podeLer (todas as da Fase 1 são leitura)
  exigeEscrita: boolean;
  // true = também exige podeVerCustos(papel) — ferramenta nem é oferecida ao
  // modelo para quem não pode ver custo/lucro/margem (ex: Vendedor)
  exigeVerCustos?: boolean;
  parametros: Record<string, unknown>; // JSON schema dos argumentos, enviado à OpenAI
  handler: (args: Record<string, unknown>, usuario: SessaoUsuario) => Promise<ToolResultado>;
};

export type MensagemConversa = {
  papel: "user" | "assistant" | "tool";
  conteudo: string;
  ferramenta?: string;
  toolCallId?: string;
};

export type ProcessarMensagemParams = {
  usuario: SessaoUsuario;
  conversaId: string;
  texto: string;
  origemEntrada: "TEXTO" | "AUDIO";
  transcricao?: string;
  requestId: string;
};

export type ProcessarMensagemResultado = {
  resposta: string;
  estado: EstadoConversa;
  // true = há uma prévia (Nível 2+) aguardando "confirmar"/"cancelar" do
  // usuário — a UI mostra os botões inline quando este campo vem true.
  aguardandoConfirmacao?: boolean;
  // Nível da prévia pendente — usado só pra UI escolher o estilo do aviso
  // (Nível 3 = ação crítica, visual reforçado).
  nivelConfirmacao?: NivelConfirmacao;
};
