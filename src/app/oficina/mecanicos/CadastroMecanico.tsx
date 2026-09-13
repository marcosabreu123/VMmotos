"use client";

import { useState } from "react";
import { MecanicoForm } from "./MecanicoForm";

/**
 * O cadastro de mecânico fica atrás de uma opção, não aberto o tempo todo.
 *
 * Cadastrar mecânico é coisa rara — acontece quando alguém entra na oficina,
 * não toda semana. Deixar o formulário sempre aberto empurrava a lista de
 * serviços e de mecânicos, que é o que se vem ver aqui, para baixo da dobra.
 */
export function CadastroMecanico() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="mb-6">
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
      >
        {aberto ? "Fechar cadastro" : "Cadastro de mecânico"}
      </button>

      {aberto && (
        <div className="mt-3">
          <MecanicoForm />
        </div>
      )}
    </div>
  );
}
