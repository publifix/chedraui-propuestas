import { describe, expect, it } from 'vitest'
import type { Plaza } from '../../schemas'
import { readYaml, SEED, seedFiles } from '../test-utils'
import { checkContrast, contrastRatio, luminance } from './contrast'
import { fontNames, isFont } from './font-roles'
import { fontFaceCss, fontStack, preloadUrls, FONT_PAIRINGS } from './fonts'
import { colorScheme, DEFAULT_MEDIDAS, fluid, resolveMedidas, SPACE_STEPS, themeCss, themeVariables, typeStep, TYPE_STEPS } from './tokens'

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
    expect(results).toHaveLength(7)
    expect(results.filter((r) => !r.pasa)).toEqual([])
  })

  it('detecta un par que no cumple', () => {
    const failing = checkContrast({ ...tema.colores, texto_suave: '#a89fb0' }).filter((r) => !r.pasa)
    expect(failing.map((r) => `${r.texto}/${r.fondo}`)).toEqual(['texto_suave/fondo', 'texto_suave/superficie'])
  })
})

describe('catálogo de fuentes', () => {
  it('distingue fuentes display y de cuerpo', () => {
    expect(isFont('Instrument Serif', 'display')).toBe(true)
    expect(isFont('Instrument Serif', 'body')).toBe(false)
    expect(isFont('Inter', 'body')).toBe(false)
    expect(fontNames('body')).toEqual(['Jost', 'Outfit', 'Urbanist'])
  })

  it('las combinaciones propuestas usan fuentes del catálogo', () => {
    for (const p of FONT_PAIRINGS) {
      expect(isFont(p.display, 'display')).toBe(true)
      expect(isFont(p.body, 'body')).toBe(true)
    }
  })

  it('declara @font-face solo de las familias pedidas, con swap y woff2 local', () => {
    const css = fontFaceCss(['Instrument Serif', 'Jost', 'Jost'])
    expect(css.match(/@font-face/g)).toHaveLength(3)
    expect(css).toContain('font-family:"Instrument Serif";font-style:normal;font-weight:400;font-display:swap')
    expect(css).toContain('font-family:"Jost";font-style:normal;font-weight:500')
    expect(css).not.toContain('Gloock')
    expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic/)
    expect(css).toMatch(/format\("woff2"\)/)
  })

  it('precarga solo el peso regular de cada familia', () => {
    expect(preloadUrls(['Instrument Serif', 'Jost'])).toHaveLength(2)
  })

  it('incluye la pila de respaldo y rechaza fuentes fuera del catálogo', () => {
    expect(fontStack('Jost')).toMatch(/^"Jost", ui-sans-serif/)
    expect(() => fontStack('Comic Sans')).toThrow('no está en el catálogo')
  })
})

describe('tokens', () => {
  const vars = themeVariables(tema)

  it('mapea los colores del tema a variables CSS', () => {
    expect(vars['--color-bg']).toBe(tema.colores.fondo)
    expect(vars['--color-accent']).toBe(tema.colores.acento)
    expect(vars['--color-on-accent']).toBe(tema.colores.superficie)
    expect(vars['--font-display']).toBe(fontStack('Instrument Serif'))
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
    expect(css).toMatch(/^:root\{--color-bg:#f6f3f8;/)
    expect(css).toContain('color-scheme:only light')
    expect(css).not.toContain('prefers-color-scheme')
  })
})
