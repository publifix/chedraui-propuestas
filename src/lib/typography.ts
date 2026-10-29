// Reglas tipográficas del visor (CLAUDE.md §9).

/** Las mayúsculas solo se usan en textos de hasta este número de palabras. */
export const MAX_UPPERCASE_WORDS = 5

/** Palabras de un texto, sin contar signos sueltos como "·", "&", "+" o "—". */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length
}

/** true si el texto puede ir en mayúsculas (hasta 5 palabras). */
export function isShortText(text: string): boolean {
  return wordCount(text) <= MAX_UPPERCASE_WORDS
}
