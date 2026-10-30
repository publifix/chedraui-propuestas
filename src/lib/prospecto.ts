// Textos derivados del prospecto. Sin dependencias: también corre en el navegador.

/** Minúsculas, sin acentos ni espacios repetidos, para comparar nombres. */
const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Dedicatoria de la portada: "Para {destinatario} · {marca}". Si el destinatario ya nombra a la
 * marca ("Equipo Rubí Perfumería"), la marca no se repite.
 */
export function dedicatoria({ destinatario, marca }: { destinatario: string; marca: string }): string {
  return normalizar(destinatario).includes(normalizar(marca)) ? `Para ${destinatario}` : `Para ${destinatario} · ${marca}`
}
