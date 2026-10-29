// Vigencia de la propuesta (CLAUDE.md §10). Sin dependencias: también corre en el navegador.

/** Fecha local AAAA-MM-DD de un instante. */
export function localIsoDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** La propuesta vence al terminar el día de su vigencia, en la hora local del visitante. */
export function isExpired(vigencia: string, now: Date): boolean {
  return localIsoDate(now) > vigencia
}

/** "30 de noviembre de 2026". */
export function formatVigencia(vigencia: string): string {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${vigencia}T00:00:00Z`),
  )
}
