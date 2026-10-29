// Fuentes autoalojadas (paquetes @fontsource, licencia OFL-1.1). Solo el subset latin,
// que cubre el español, y solo los pesos que usa el visor. Vite copia los .woff2 al sitio:
// nada se descarga de Google Fonts en tiempo de carga. Todas las familias de display y
// cuerpo traen cifras tabulares (feature tnum), verificado sobre los archivos.
import unbounded500 from '@fontsource/unbounded/files/unbounded-latin-500-normal.woff2?url'
import barlowCondensed600 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2?url'
import archivoVariable from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2?url'
import figtree400 from '@fontsource/figtree/files/figtree-latin-400-normal.woff2?url'
import figtree600 from '@fontsource/figtree/files/figtree-latin-600-normal.woff2?url'
import publicSans400 from '@fontsource/public-sans/files/public-sans-latin-400-normal.woff2?url'
import publicSans600 from '@fontsource/public-sans/files/public-sans-latin-600-normal.woff2?url'
import instrumentSerifItalic from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url'
import newsreaderItalic from '@fontsource/newsreader/files/newsreader-latin-400-italic.woff2?url'
import frauncesItalic from '@fontsource/fraunces/files/fraunces-latin-400-italic.woff2?url'
import { FONT_ROLES, type FontName } from './font-roles'

interface FontFile {
  url: string
  /** Peso fijo o rango de una fuente variable. */
  weight: number | readonly [number, number]
  style: 'normal' | 'italic'
  /** Rango de ancho (%) de una fuente variable. */
  stretch?: readonly [number, number]
}

/** Cómo se usa la familia en titulares y cifras grandes. */
export interface DisplayTreatment {
  transform: 'none' | 'uppercase'
  tracking: string
  weight: number
  stretch: string
  /** Factor sobre la escala tipográfica: una ancha en mayúsculas necesita menos tamaño. */
  size: number
  /** Factor para cifras grandes: los números no van en mayúsculas y aguantan más tamaño. */
  figureSize: number
  leading: number
}

/** Cómo se usa la familia en cuerpo y etiquetas. */
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
  Unbounded: {
    fallback: SANS_FALLBACK,
    files: [{ url: unbounded500, weight: 500, style: 'normal' }],
    display: { transform: 'uppercase', tracking: '0.06em', weight: 500, stretch: 'normal', size: 0.62, figureSize: 0.82, leading: 1.08 },
  },
  'Barlow Condensed': {
    fallback: SANS_FALLBACK,
    files: [{ url: barlowCondensed600, weight: 600, style: 'normal' }],
    display: { transform: 'none', tracking: '0', weight: 600, stretch: 'normal', size: 1, figureSize: 1, leading: 0.94 },
  },
  Archivo: {
    fallback: SANS_FALLBACK,
    files: [{ url: archivoVariable, weight: [100, 900], stretch: [62, 125], style: 'normal' }],
    display: { transform: 'none', tracking: '-0.01em', weight: 780, stretch: '68%', size: 1, figureSize: 1, leading: 0.94 },
    text: { weight: 400, strongWeight: 600, labelWeight: 600, labelStretch: '125%' },
  },
  Figtree: {
    fallback: SANS_FALLBACK,
    files: [
      { url: figtree400, weight: 400, style: 'normal' },
      { url: figtree600, weight: 600, style: 'normal' },
    ],
    text: { weight: 400, strongWeight: 600, labelWeight: 600, labelStretch: 'normal' },
  },
  'Public Sans': {
    fallback: SANS_FALLBACK,
    files: [
      { url: publicSans400, weight: 400, style: 'normal' },
      { url: publicSans600, weight: 600, style: 'normal' },
    ],
    text: { weight: 400, strongWeight: 600, labelWeight: 600, labelStretch: 'normal' },
  },
  'Instrument Serif': { fallback: SERIF_FALLBACK, files: [{ url: instrumentSerifItalic, weight: 400, style: 'italic' }] },
  Newsreader: { fallback: SERIF_FALLBACK, files: [{ url: newsreaderItalic, weight: 400, style: 'italic' }] },
  Fraunces: { fallback: SERIF_FALLBACK, files: [{ url: frauncesItalic, weight: 400, style: 'italic' }] },
}

/** Combinaciones propuestas para revisión, con una serif itálica opcional solo para la cita pivote. */
export const FONT_PAIRINGS = [
  {
    id: '1',
    display: 'Unbounded',
    body: 'Figtree',
    cita: 'Instrument Serif',
    nota: 'Geométrica ancha en mayúsculas con tracking amplio, en el espíritu del logo; cuerpo geométrico muy legible.',
  },
  {
    id: '2',
    display: 'Barlow Condensed',
    body: 'Public Sans',
    cita: 'Newsreader',
    nota: 'Grotesca condensada para titulares grandes; cuerpo neutro pensado para pantallas pequeñas.',
  },
  {
    id: '3',
    display: 'Archivo',
    body: 'Archivo',
    cita: 'Fraunces',
    nota: 'Una sola familia variable: titulares condensados y gruesos, etiquetas expandidas, cuerpo en ancho normal.',
  },
] as const satisfies ReadonlyArray<{ id: string; display: FontName; body: FontName; cita: FontName; nota: string }>

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
