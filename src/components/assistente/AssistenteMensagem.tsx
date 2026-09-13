export function AssistenteMensagem({ papel, texto }: { papel: "user" | "assistant"; texto: string }) {
  return (
    <div
      className={`assistente-mensagem ${papel === "user" ? "assistente-mensagem-usuario" : "assistente-mensagem-assistente"}`}
    >
      {texto}
    </div>
  );
}
