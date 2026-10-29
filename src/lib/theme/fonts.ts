// Fuentes autoalojadas (paquetes @fontsource, licencia OFL-1.1). Solo el subset latin,
// que cubre el español. Vite copia los .woff2 al sitio: nada se descarga de Google Fonts
// en tiempo de carga. Archivo trae cifras tabulares (feature tnum), verificado sobre el archivo.
import archivoVariable from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2?url'
import newsreaderItalic from '@fontsource/newsreader/files/newsreader-latin-400-italic.woff2?url'
import { FONT_ROLES, type FontName } from './font-roles'

interface FontFile {
  url: string
  /** Peso fijo o rango de una fuente variable. */
  weight: number | readonly [number, number]
  style: 'normal' | 'italic'
  /** Rango de ancho (%) de una fuente variable. */
  stretch?: readonly [number, number]
}

/** Tratamiento de un estilo de titular. */
export interface TitleStyle {
  transform: 'none' | 'uppercase'
  tracking: string
  weight: number
  stretch: string
  /** Factor sobre la escala tipográfica. */
  size: number
  leading: number
}

/**
 * Estilos de una familia de display (CLAUDE.md §9):
 * short: textos de hasta 5 palabras (etiquetas grandes, nombre de plaza, titulares cortos), en mayúsculas;
 * long: titulares de más de 5 palabras, en mayúsculas y minúsculas;
 * figure: cifras grandes, siempre con números tabulares.
 */
export interface DisplayTreatment {
  short: TitleStyle
  long: TitleStyle
  figure: { weight: number; stretch: string; size: number }
}

/** Cuerpo y etiquetas. */
export interface TextTreatment {
  weight: number
  strongWeight: number
  labelWeight: number
  labelStretch: string
}

export interface FontFamily {
  fallback: string
  files: readonly FontFile[]
  display?: DisplayTreatment
  text?: TextTreatment
}

const SANS_FALLBACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const SERIF_FALLBACK = 'Georgia, "Times New Roman", serif'

export const FONTS: Record<FontName, FontFamily> = {
  Archivo: {
    fallback: SANS_FALLBACK,
    files: [{ url: archivoVariable, weight: [100, 900], stretch: [62, 125], style: 'normal' }],
    display: {
      // size 0.70: "PERFUMERÍA" en el paso 6 a 360 px mide 437 px con factor 1 y el ancho útil es 312 px.
      short: { transform: 'uppercase', tracking: '0.06em', weight: 640, stretch: '125%', size: 0.7, leading: 1.02 },
      long: { transform: 'none', tracking: '-0.01em', weight: 760, stretch: '70%', size: 1, leading: 0.96 },
      figure: { weight: 640, stretch: '100%', size: 1 },
    },
    text: { weight: 400, strongWeight: 600, labelWeight: 600, labelStretch: '125%' },
  },
  Newsreader: { fallback: SERIF_FALLBACK, files: [{ url: newsreaderItalic, weight: 400, style: 'italic' }] },
}

// Rango del subset latin de Google Fonts / Fontsource.
const LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'

export function family(name: string): FontFamily {
  const font = name in FONT_ROLES ? FONTS[name as FontName] : undefined
  if (!font) throw new Error(`la fuente "${name}" no está en el catálogo (src/lib/theme/fonts.ts)`)
  return font
}

/** Valor de font-family con su respaldo. */
export function fontStack(name: string): string {
  return `"${name}", ${family(name).fallback}`
}

const range = (value: number | readonly [number, number], unit = '') =>
  typeof value === 'number' ? `${value}${unit}` : `${value[0]}${unit} ${value[1]}${unit}`

/** Declaraciones @font-face solo de las familias indicadas. */
export function fontFaceCss(names: readonly string[]): string {
  return [...new Set(names)]
    .flatMap((name) =>
      family(name).files.map((f) =>
        [
          `@font-face{font-family:"${name}"`,
          `font-style:${f.style}`,
          `font-weight:${range(f.weight)}`,
          ...(f.stretch ? [`font-stretch:${range(f.stretch, '%')}`] : []),
          'font-display:swap',
          `src:url(${f.url}) format("woff2")`,
          `unicode-range:${LATIN_RANGE}}`,
        ].join(';'),
      ),
    )
    .join('\n')
}

/** Primer archivo de cada familia, para <link rel="preload">. */
export function preloadUrls(names: readonly string[]): string[] {
  return [...new Set(names.map((name) => family(name).files[0]!.url))]
}
