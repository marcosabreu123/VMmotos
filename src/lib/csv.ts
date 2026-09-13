export function escaparCampoCsv(valor: string): string {
  if (/[",\n\r]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export function montarLinhaCsv(campos: string[]): string {
  return campos.map(escaparCampoCsv).join(",");
}

// Parser manual de CSV: suporta campos entre aspas com vírgula/aspas internas (única
// regra de escaping que o formato exige), sem depender de nenhuma lib externa.
export function parsearCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campoAtual = "";
  let linhaAtual: string[] = [];
  let dentroDeAspas = false;

  const normalizado = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let indice = 0; indice < normalizado.length; indice++) {
    const caractere = normalizado[indice];

    if (dentroDeAspas) {
      if (caractere === '"') {
        if (normalizado[indice + 1] === '"') {
          campoAtual += '"';
          indice++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        campoAtual += caractere;
      }
      continue;
    }

    if (caractere === '"') {
      dentroDeAspas = true;
    } else if (caractere === ",") {
      linhaAtual.push(campoAtual);
      campoAtual = "";
    } else if (caractere === "\n") {
      linhaAtual.push(campoAtual);
      linhas.push(linhaAtual);
      linhaAtual = [];
      campoAtual = "";
    } else {
      campoAtual += caractere;
    }
  }

  if (campoAtual.length > 0 || linhaAtual.length > 0) {
    linhaAtual.push(campoAtual);
    linhas.push(linhaAtual);
  }

  return linhas.filter((linha) => linha.some((campo) => campo.trim().length > 0));
}
