import type { Plaza } from '../../schemas'

type Colores = Plaza['tema']['colores']
export type ColorName = keyof Colores

/** Pares de texto sobre fondo que el tema debe cumplir (WCAG 2.x, AA texto normal = 4.5:1). */
export const CONTRAST_PAIRS: ReadonlyArray<{ texto: ColorName; fondo: ColorName }> = [
  { texto: 'texto', fondo: 'fondo' },
  { texto: 'texto', fondo: 'superficie' },
  { texto: 'texto_suave', fondo: 'fondo' },
  { texto: 'texto_suave', fondo: 'superficie' },
  { texto: 'acento', fondo: 'fondo' },
  { texto: 'acento', fondo: 'superficie' },
  // Texto sobre bandas y botones de acento.
  { texto: 'superficie', fondo: 'acento' },
  // Secciones a sangre en el color de marca.
  { texto: 'texto_marca', fondo: 'marca' },
]

export const AA_NORMAL_TEXT = 4.5

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
  ratio: number
  pasa: boolean
}

export function checkContrast(colores: Colores): ContrastResult[] {
  return CONTRAST_PAIRS.map(({ texto, fondo }) => {
    const ratio = contrastRatio(colores[texto], colores[fondo])
    return { texto, fondo, ratio, pasa: ratio >= AA_NORMAL_TEXT }
  })
}
