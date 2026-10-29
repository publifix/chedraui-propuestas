import type { Plaza } from '../../schemas'

type Colores = Plaza['tema']['colores']
export type ColorName = keyof Colores

/** WCAG 2.x AA: texto normal 4.5:1; elementos gráficos (barras, rangos) 3:1 (criterio 1.4.11). */
export const AA_NORMAL_TEXT = 4.5
export const AA_GRAPHIC = 3

export type PairKind = 'texto' | 'grafica'

/** Pares que el tema debe cumplir: texto sobre fondo y gráficas sobre fondo. */
export const CONTRAST_PAIRS: ReadonlyArray<{ texto: ColorName; fondo: ColorName; tipo: PairKind }> = [
  { texto: 'texto', fondo: 'fondo', tipo: 'texto' },
  { texto: 'texto', fondo: 'superficie', tipo: 'texto' },
  { texto: 'texto_suave', fondo: 'fondo', tipo: 'texto' },
  { texto: 'texto_suave', fondo: 'superficie', tipo: 'texto' },
  { texto: 'acento', fondo: 'fondo', tipo: 'texto' },
  { texto: 'acento', fondo: 'superficie', tipo: 'texto' },
  // Texto sobre bandas y botones de acento.
  { texto: 'superficie', fondo: 'acento', tipo: 'texto' },
  // Secciones a sangre en el color de marca.
  { texto: 'texto_marca', fondo: 'marca', tipo: 'texto' },
  // Etiquetas dentro de barras en acento suave.
  { texto: 'superficie', fondo: 'acento_suave', tipo: 'texto' },
  // Barras y rangos en acento suave sobre la página.
  { texto: 'acento_suave', fondo: 'fondo', tipo: 'grafica' },
  { texto: 'acento_suave', fondo: 'superficie', tipo: 'grafica' },
]

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** Luminancia relativa de un color hex (#rgb, #rrggbb o #rrggbbaa; se ignora el alfa). */
export function luminance(hex: string): number {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

export interface ContrastResult {
  texto: ColorName
  fondo: ColorName
  tipo: PairKind
  ratio: number
  minimo: number
  pasa: boolean
}

export function checkContrast(colores: Colores): ContrastResult[] {
  return CONTRAST_PAIRS.map(({ texto, fondo, tipo }) => {
    const ratio = contrastRatio(colores[texto], colores[fondo])
    const minimo = tipo === 'texto' ? AA_NORMAL_TEXT : AA_GRAPHIC
    return { texto, fondo, tipo, ratio, minimo, pasa: ratio >= minimo }
  })
}
