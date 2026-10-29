// Comparación de giros para la capa "giros afines" del plano: sin mayúsculas ni acentos.

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function esGiroAfin(giro: string, afines: readonly string[] = []): boolean {
  const g = normalize(giro)
  return afines.some((a) => normalize(a) === g)
}
