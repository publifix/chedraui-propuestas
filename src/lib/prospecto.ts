// Textos derivados del prospecto. Sin dependencias: también corre en el navegador.

/** Minúsculas, sin acentos ni espacios repetidos, para comparar nombres. */
const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Dedicatoria de la portada: "Para {destinatario} · {marca}". Si el destinatario ya nombra a la
 * marca ("Equipo Rubí Perfumería"), la marca no se repite.
 */
/** El destinatario es una persona (no un equipo que ya nombra a la marca). */
export function esPersona({ destinatario, marca }: { destinatario: string; marca: string }): boolean {
  return !normalizar(destinatario).includes(normalizar(marca))
}

/** Cómo se presenta el prospecto en un mensaje: "Gabriela Álvarez, de Rubí Perfumería" o "de Rubí Perfumería". */
export function remitente(p: { destinatario: string; marca: string }): string {
  return esPersona(p) ? `${p.destinatario}, de ${p.marca}` : `de ${p.marca}`
}

export function dedicatoria({ destinatario, marca }: { destinatario: string; marca: string }): string {
  return esPersona({ destinatario, marca }) ? `Para ${destinatario} · ${marca}` : `Para ${destinatario}`
}
