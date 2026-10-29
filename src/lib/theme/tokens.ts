import type { Plaza } from '../../schemas'
import { luminance } from './contrast'
import { family, fontStack } from './fonts'

type Tema = Plaza['tema']
export type Medidas = { [K in keyof NonNullable<Tema['medidas']>]-?: number }

/** Valores del motor cuando la plaza no define tema.medidas. */
export const DEFAULT_MEDIDAS: Medidas = {
  escala: 1.333,
  espacio_base: 16,
  radio: 2,
  linea: 1,
  duracion_ms: 700,
}

// Rango de viewport para la interpolación fluida: celular angosto → escritorio.
const VIEWPORT_MIN = 360
const VIEWPORT_MAX = 1280
const ROOT_PX = 16

// Escala tipográfica: en celular la razón es menor que en escritorio para no desbordar.
const BODY_MIN_PX = 16
const BODY_MAX_PX = 18
const RATIO_MIN = 1.2
const DISPLAY_CAP_PX = 96
export const TYPE_STEPS = [-2, -1, 0, 1, 2, 3, 4, 5, 6] as const

// Escala de espacios: múltiplos de espacio_base que crecen 25 % hacia escritorio.
export const SPACE_STEPS = { '3xs': 0.25, '2xs': 0.5, xs: 0.75, s: 1, m: 1.5, l: 2, xl: 3, '2xl': 4, '3xl': 6 } as const
const SPACE_GROWTH = 1.25

/** tema.medidas con los valores del motor donde la plaza no define uno. */
export function resolveMedidas(tema: Tema): Medidas {
  const defined = Object.entries(tema.medidas ?? {}).filter(([, v]) => v !== undefined)
  return { ...DEFAULT_MEDIDAS, ...Object.fromEntries(defined) }
}

const rem = (px: number) => `${+(px / ROOT_PX).toFixed(4)}rem`

/** clamp() que interpola de minPx (viewport 360) a maxPx (viewport 1280). */
export function fluid(minPx: number, maxPx: number): string {
  const slope = (maxPx - minPx) / (VIEWPORT_MAX - VIEWPORT_MIN)
  const intercept = minPx - slope * VIEWPORT_MIN
  return `clamp(${rem(minPx)}, ${rem(intercept)} + ${+(slope * 100).toFixed(4)}vw, ${rem(maxPx)})`
}

/** Tamaño mínimo de cualquier paso: nada del visor se lee por debajo de 12 px. */
const TEXT_FLOOR_PX = 12

/** Tamaño en celular (minPx) y en escritorio (maxPx) de un paso de la escala. */
export function typeStep(step: number, escala: number): { minPx: number; maxPx: number } {
  const minPx = Math.max(TEXT_FLOOR_PX, Math.min(BODY_MIN_PX * RATIO_MIN ** step, DISPLAY_CAP_PX))
  const maxPx = Math.max(minPx, Math.min(BODY_MAX_PX * escala ** step, DISPLAY_CAP_PX))
  return { minPx, maxPx }
}

/** Variables CSS del tema de una plaza. Ningún componente define colores, fuentes ni medidas propios. */
export function themeVariables(tema: Tema): Record<string, string> {
  const m = resolveMedidas(tema)
  const c = tema.colores
  const vars: Record<string, string> = {
    '--color-bg': c.fondo,
    '--color-surface': c.superficie,
    '--color-text': c.texto,
    '--color-text-muted': c.texto_suave,
    '--color-accent': c.acento,
    '--color-on-accent': c.superficie,
    '--color-line': c.linea,
    '--color-brand': c.marca,
    '--color-on-brand': c.texto_marca,
    ...typographyVariables(tema.tipografias),
    '--radius-s': `${m.radio}px`,
    '--radius-m': `${m.radio * 2}px`,
    '--line-width': `${m.linea}px`,
    '--duration': `${m.duracion_ms}ms`,
    '--duration-fast': `${Math.round(m.duracion_ms * 0.4)}ms`,
    '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
    '--tracking-label': '0.14em',
    '--measure': '65ch',
  }
  for (const step of TYPE_STEPS) {
    const { minPx, maxPx } = typeStep(step, m.escala)
    vars[`--step-${step}`] = fluid(minPx, maxPx)
  }
  for (const [name, factor] of Object.entries(SPACE_STEPS)) {
    const minPx = m.espacio_base * factor
    vars[`--space-${name}`] = fluid(minPx, minPx * SPACE_GROWTH)
  }
  return vars
}

/**
 * Familias y su tratamiento (mayúsculas, tracking, peso, ancho, factor de tamaño) según el
 * catálogo. Sin `cita`, la cita pivote usa la familia de display sin mayúsculas.
 */
export function typographyVariables(t: Tema['tipografias']): Record<string, string> {
  const display = family(t.display).display!
  const text = family(t.cuerpo).text!
  return {
    '--font-display': fontStack(t.display),
    '--font-body': fontStack(t.cuerpo),
    '--font-quote': fontStack(t.cita ?? t.display),
    '--quote-style': t.cita ? 'italic' : 'normal',
    '--quote-weight': t.cita ? '400' : String(display.weight),
    '--display-transform': display.transform,
    '--display-tracking': display.tracking,
    '--display-weight': String(display.weight),
    '--display-stretch': display.stretch,
    '--display-size': String(display.size),
    '--figure-size': String(display.figureSize),
    '--display-leading': String(display.leading),
    '--body-weight': String(text.weight),
    '--strong-weight': String(text.strongWeight),
    '--label-weight': String(text.labelWeight),
    '--label-stretch': text.labelStretch,
  }
}

/** Familias que necesita un tema: display, cuerpo y, si existe, la de la cita. */
export function themeFonts(t: Tema['tipografias']): string[] {
  return [t.display, t.cuerpo, ...(t.cita ? [t.cita] : [])]
}

/** El tema es fijo: claro u oscuro según el fondo de la plaza, nunca según el dispositivo. */
export function colorScheme(tema: Tema): 'only light' | 'only dark' {
  return luminance(tema.colores.fondo) > 0.18 ? 'only light' : 'only dark'
}

/** Bloque :root listo para inyectar en el <head> de la presentación. */
export function themeCss(tema: Tema): string {
  const declarations = Object.entries(themeVariables(tema)).map(([k, v]) => `${k}:${v}`)
  declarations.push(`color-scheme:${colorScheme(tema)}`)
  return `:root{${declarations.join(';')}}`
}
