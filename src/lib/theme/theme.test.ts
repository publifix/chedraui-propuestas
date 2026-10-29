import { describe, expect, it } from 'vitest'
import type { Plaza } from '../../schemas'
import { readYaml, SEED, seedFiles } from '../test-utils'
import { checkContrast, contrastRatio, luminance } from './contrast'
import { fontNames, isFont } from './font-roles'
import { family, fontFaceCss, fontStack, preloadUrls, FONT_PAIRINGS } from './fonts'
import { colorScheme, DEFAULT_MEDIDAS, fluid, resolveMedidas, SPACE_STEPS, themeCss, themeFonts, themeVariables, typeStep, TYPE_STEPS, typographyVariables } from './tokens'

const tema = readYaml(seedFiles(), SEED.plaza)['tema'] as Plaza['tema']

describe('contraste WCAG', () => {
  it('calcula la luminancia y el contraste de referencia', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 10)
    expect(luminance('#000')).toBe(0)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10)
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 10)
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  })

  it('los colores provisionales de El Dorado cumplen AA en todos los pares', () => {
    const results = checkContrast(tema.colores)
    expect(results).toHaveLength(8)
    expect(results.filter((r) => !r.pasa)).toEqual([])
  })

  it('detecta un par que no cumple', () => {
    const failing = checkContrast({ ...tema.colores, texto_suave: '#a89fb0' }).filter((r) => !r.pasa)
    expect(failing.map((r) => `${r.texto}/${r.fondo}`)).toEqual(['texto_suave/fondo', 'texto_suave/superficie'])
  })

  it('valida el texto sobre el fondo de marca', () => {
    expect(checkContrast(tema.colores).find((r) => r.fondo === 'marca')).toMatchObject({ texto: 'texto_marca', pasa: true })
    const failing = checkContrast({ ...tema.colores, texto_marca: '#b98ab9' }).filter((r) => !r.pasa)
    expect(failing.map((r) => `${r.texto}/${r.fondo}`)).toEqual(['texto_marca/marca'])
  })

  it('el morado de marca de El Dorado es el del PDF de Chedraui', () => {
    expect(tema.colores.marca).toBe('#660066')
  })
})

describe('catálogo de fuentes', () => {
  it('distingue fuentes de display, cuerpo y cita', () => {
    expect(isFont('Unbounded', 'display')).toBe(true)
    expect(isFont('Unbounded', 'body')).toBe(false)
    expect(isFont('Archivo', 'display') && isFont('Archivo', 'body')).toBe(true)
    expect(isFont('Instrument Serif', 'quote')).toBe(true)
    expect(isFont('Instrument Serif', 'display')).toBe(false)
    expect(isFont('Inter', 'body')).toBe(false)
    expect(fontNames('body')).toEqual(['Archivo', 'Figtree', 'Public Sans'])
  })

  it('las tres combinaciones son sans, con cita serif opcional, y usan fuentes del catálogo', () => {
    expect(FONT_PAIRINGS.map((p) => p.display)).toEqual(['Unbounded', 'Barlow Condensed', 'Archivo'])
    for (const p of FONT_PAIRINGS) {
      expect(isFont(p.display, 'display')).toBe(true)
      expect(isFont(p.body, 'body')).toBe(true)
      expect(isFont(p.cita, 'quote')).toBe(true)
      expect(family(p.display).fallback).toMatch(/sans-serif$/)
      expect(family(p.cita).files.every((f) => f.style === 'italic')).toBe(true)
    }
  })

  it('declara @font-face solo de las familias pedidas, con swap y woff2 local', () => {
    const css = fontFaceCss(['Unbounded', 'Figtree', 'Figtree'])
    expect(css.match(/@font-face/g)).toHaveLength(3)
    expect(css).toContain('font-family:"Unbounded";font-style:normal;font-weight:500;font-display:swap')
    expect(css).toContain('font-family:"Figtree";font-style:normal;font-weight:600')
    expect(css).not.toContain('Archivo')
    expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic/)
    expect(css).toMatch(/format\("woff2"\)/)
  })

  it('declara la fuente variable con sus rangos de peso y ancho', () => {
    expect(fontFaceCss(['Archivo'])).toContain('font-weight:100 900;font-stretch:62% 125%')
  })

  it('declara la cita como itálica', () => {
    expect(fontFaceCss(['Newsreader'])).toContain('font-style:italic;font-weight:400')
  })

  it('precarga un archivo por familia', () => {
    expect(preloadUrls(['Unbounded', 'Figtree'])).toHaveLength(2)
    expect(preloadUrls(['Archivo', 'Archivo'])).toHaveLength(1)
  })

  it('incluye la pila de respaldo y rechaza fuentes fuera del catálogo', () => {
    expect(fontStack('Figtree')).toMatch(/^"Figtree", ui-sans-serif/)
    expect(() => fontStack('Comic Sans')).toThrow('no está en el catálogo')
  })
})

describe('tokens', () => {
  const vars = themeVariables(tema)

  it('mapea los colores del tema a variables CSS', () => {
    expect(vars['--color-bg']).toBe(tema.colores.fondo)
    expect(vars['--color-accent']).toBe(tema.colores.acento)
    expect(vars['--color-on-accent']).toBe(tema.colores.superficie)
    expect(vars['--color-brand']).toBe('#660066')
    expect(vars['--color-on-brand']).toBe(tema.colores.texto_marca)
    expect(vars['--font-display']).toBe(fontStack('Unbounded'))
  })

  it('aplica el tratamiento del catálogo: mayúsculas y tracking amplio en la display ancha', () => {
    expect(typographyVariables({ display: 'Unbounded', cuerpo: 'Figtree' })).toMatchObject({
      '--display-transform': 'uppercase',
      '--display-tracking': '0.06em',
      '--display-size': '0.62',
      '--figure-size': '0.82',
      '--label-stretch': 'normal',
    })
  })

  it('una sola familia variable cambia de ancho entre titulares y etiquetas', () => {
    expect(typographyVariables({ display: 'Archivo', cuerpo: 'Archivo' })).toMatchObject({
      '--display-stretch': '68%',
      '--label-stretch': '125%',
    })
  })

  it('la cita usa la serif itálica si existe y si no la display sin mayúsculas', () => {
    expect(typographyVariables({ display: 'Barlow Condensed', cuerpo: 'Public Sans', cita: 'Newsreader' })).toMatchObject({
      '--font-quote': fontStack('Newsreader'),
      '--quote-style': 'italic',
    })
    expect(typographyVariables({ display: 'Barlow Condensed', cuerpo: 'Public Sans' })).toMatchObject({
      '--font-quote': fontStack('Barlow Condensed'),
      '--quote-style': 'normal',
    })
  })

  it('carga solo las familias del tema', () => {
    expect(themeFonts({ display: 'Unbounded', cuerpo: 'Figtree' })).toEqual(['Unbounded', 'Figtree'])
    expect(themeFonts({ display: 'Unbounded', cuerpo: 'Figtree', cita: 'Instrument Serif' })).toHaveLength(3)
  })

  it('genera la escala tipográfica y de espacios completas, fluidas con clamp', () => {
    for (const step of TYPE_STEPS) expect(vars[`--step-${step}`]).toMatch(/^clamp\(/)
    for (const name of Object.keys(SPACE_STEPS)) expect(vars[`--space-${name}`]).toMatch(/^clamp\(/)
    expect(Object.values(vars).every((v) => v && !v.includes('undefined') && !v.includes('NaN'))).toBe(true)
  })

  it('fluid interpola de 360 a 1280 px de viewport', () => {
    // 16 → 18 px: pendiente 2/920 px, intercepto 16 - 360 × 2/920.
    expect(fluid(16, 18)).toBe('clamp(1rem, 0.9511rem + 0.2174vw, 1.125rem)')
  })

  it('el cuerpo va de 16 a 18 px y el display no pasa de 96 px', () => {
    expect(typeStep(0, 1.333)).toEqual({ minPx: 16, maxPx: 18 })
    expect(typeStep(6, 1.333).maxPx).toBe(96)
  })

  it('ningún paso baja de 12 px y el mínimo nunca supera al máximo', () => {
    for (const step of TYPE_STEPS) {
      const { minPx, maxPx } = typeStep(step, 1.5)
      expect(minPx).toBeGreaterThanOrEqual(12)
      expect(maxPx).toBeGreaterThanOrEqual(minPx)
    }
  })

  it('usa las medidas de la plaza y completa las faltantes con las del motor', () => {
    expect(resolveMedidas(tema)).toEqual(DEFAULT_MEDIDAS)
    const custom = { ...tema, medidas: { radio: 8, duracion_ms: 400 } }
    expect(resolveMedidas(custom)).toEqual({ ...DEFAULT_MEDIDAS, radio: 8, duracion_ms: 400 })
    expect(themeVariables(custom)).toMatchObject({ '--radius-s': '8px', '--radius-m': '16px', '--duration': '400ms' })
  })

  it('fija el esquema de color según el fondo de la plaza, no según el dispositivo', () => {
    expect(colorScheme(tema)).toBe('only light')
    expect(colorScheme({ ...tema, colores: { ...tema.colores, fondo: '#140c1c' } })).toBe('only dark')
    const css = themeCss(tema)
    expect(css).toMatch(/^:root\{--color-bg:#f9f5f8;/)
    expect(css).toContain('color-scheme:only light')
    expect(css).not.toContain('prefers-color-scheme')
  })
})
