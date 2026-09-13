// Décimos da unidade de medida — usado pela venda fracionada (granel, decant, corte).
// Mantido aqui só para os campos do schema que já preveem esse uso na Fase 2.x.
export const ML_SCALE = 10;

export function mlParaUnidadeInterna(ml: number): number {
  return Math.round(ml * ML_SCALE);
}

export function unidadeInternaParaMl(valor: number): number {
  return valor / ML_SCALE;
}
