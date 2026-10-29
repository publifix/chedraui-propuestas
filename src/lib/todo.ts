// Marcador de dato pendiente, sin dependencias: lo usan también los scripts del navegador
// (simulador del business case), que no deben cargar Zod.
const TODO = /^TODO\b/

export function isTodo(value: unknown): value is `TODO${string}` {
  return typeof value === 'string' && TODO.test(value)
}
