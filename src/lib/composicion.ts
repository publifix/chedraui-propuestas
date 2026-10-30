// Composición gráfica que ocupa el lugar de una foto que falta (CLAUDE.md §7.5.2). Sale del
// propio contenido: si un texto trae una cifra, esa cifra es la protagonista.

export interface Cifra {
  cifra: string
  etiqueta: string
}

const CIFRA = /(más de\s+|\+)?(\d[\d,.]*(?:\s+mil)?(?:\s*m²)?)\s+([^,.;:]+)/i

/**
 * Primera cifra de los textos, con las palabras que la siguen como etiqueta:
 * "160 mil m² de construcción" → { cifra: "160 mil m²", etiqueta: "de construcción" };
 * "Más de 50 atracciones, arcade" → { cifra: "+50", etiqueta: "atracciones" }.
 */
export function cifraDe(...textos: Array<string | undefined>): Cifra | undefined {
  for (const texto of textos) {
    const m = texto && CIFRA.exec(texto)
    if (!m) continue
    const etiqueta = m[3]!.trim().split(/\s+/).slice(0, 4).join(' ')
    return { cifra: `${m[1] ? '+' : ''}${m[2]!.trim()}`, etiqueta }
  }
  return undefined
}
