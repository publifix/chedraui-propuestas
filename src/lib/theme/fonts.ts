// Fuentes autoalojadas (paquetes @fontsource, licencia OFL-1.1). Solo el subset latin,
// que cubre el español, y solo los pesos que usa el visor. Vite copia los .woff2 al sitio:
// nada se descarga de Google Fonts en tiempo de carga.
import instrumentSerif400 from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url'
import gloock400 from '@fontsource/gloock/files/gloock-latin-400-normal.woff2?url'
import bodoniModa400 from '@fontsource/bodoni-moda/files/bodoni-moda-latin-400-normal.woff2?url'
import jost400 from '@fontsource/jost/files/jost-latin-400-normal.woff2?url'
import jost500 from '@fontsource/jost/files/jost-latin-500-normal.woff2?url'
import outfit400 from '@fontsource/outfit/files/outfit-latin-400-normal.woff2?url'
import outfit500 from '@fontsource/outfit/files/outfit-latin-500-normal.woff2?url'
import urbanist400 from '@fontsource/urbanist/files/urbanist-latin-400-normal.woff2?url'
import urbanist500 from '@fontsource/urbanist/files/urbanist-latin-500-normal.woff2?url'

import { FONT_ROLES, type FontName } from './font-roles'

export interface FontFamily {
  /** Pila de respaldo mientras carga la fuente (font-display: swap). */
  fallback: string
  files: Array<{ weight: number; url: string }>
}

const SERIF_FALLBACK = 'Georgia, "Times New Roman", serif'
const SANS_FALLBACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'

/** Catálogo de familias que una plaza puede elegir en tema.tipografias. */
export const FONTS: Record<FontName, FontFamily> = {
  'Instrument Serif': { fallback: SERIF_FALLBACK, files: [{ weight: 400, url: instrumentSerif400 }] },
  Gloock: { fallback: SERIF_FALLBACK, files: [{ weight: 400, url: gloock400 }] },
  'Bodoni Moda': { fallback: SERIF_FALLBACK, files: [{ weight: 400, url: bodoniModa400 }] },
  Jost: {
    fallback: SANS_FALLBACK,
    files: [
      { weight: 400, url: jost400 },
      { weight: 500, url: jost500 },
    ],
  },
  Outfit: {
    fallback: SANS_FALLBACK,
    files: [
      { weight: 400, url: outfit400 },
      { weight: 500, url: outfit500 },
    ],
  },
  Urbanist: {
    fallback: SANS_FALLBACK,
    files: [
      { weight: 400, url: urbanist400 },
      { weight: 500, url: urbanist500 },
    ],
  },
}

/** Combinaciones propuestas para revisión (paso 4). */
export const FONT_PAIRINGS = [
  { id: 'A', display: 'Instrument Serif', body: 'Jost', nota: 'Serif condensada de alto contraste con una geométrica de raíz Futura.' },
  { id: 'B', display: 'Gloock', body: 'Outfit', nota: 'Serif display de alto contraste, más ancha, con una geométrica redondeada.' },
  { id: 'C', display: 'Bodoni Moda', body: 'Urbanist', nota: 'Didona de contraste extremo con una geométrica limpia.' },
] as const

// Rango del subset latin de Google Fonts / Fontsource.
const LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'

function family(name: string): FontFamily {
  const font = name in FONT_ROLES ? FONTS[name as FontName] : undefined
  if (!font) throw new Error(`la fuente "${name}" no está en el catálogo (src/lib/theme/fonts.ts)`)
  return font
}

/** Valor de font-family con su respaldo. */
export function fontStack(name: string): string {
  return `"${name}", ${family(name).fallback}`
}

/** Declaraciones @font-face solo de las familias indicadas. */
export function fontFaceCss(names: readonly string[]): string {
  return [...new Set(names)]
    .flatMap((name) =>
      family(name).files.map(
        ({ weight, url }) =>
          `@font-face{font-family:"${name}";font-style:normal;font-weight:${weight};font-display:swap;src:url(${url}) format("woff2");unicode-range:${LATIN_RANGE}}`,
      ),
    )
    .join('\n')
}

/** Archivo de peso regular de cada familia, para <link rel="preload">. */
export function preloadUrls(names: readonly string[]): string[] {
  return [...new Set(names)].map((name) => family(name).files[0]!.url)
}
