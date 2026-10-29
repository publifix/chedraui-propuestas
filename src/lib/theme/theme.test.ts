import { describe, expect, it } from 'vitest'
import type { Plaza } from '../../schemas'
import { readYaml, SEED, seedFiles } from '../test-utils'
import { checkContrast, contrastRatio, luminance } from './contrast'
import { fontNames, isFont } from './font-roles'
import { family, fontFaceCss, fontStack, preloadUrls } from './fonts'
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
    expect(results).toHaveLength(11)
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

  it('el morado de marca y el acento suave de El Dorado salen del PDF de Chedraui', () => {
    expect(tema.colores.marca).toBe('#660066')
    // #660066 al 66 % de opacidad sobre blanco.
    expect(tema.colores.acento_suave).toBe('#9a579a')
  })

  it('valida el acento suave como texto blanco encima (4.5:1) y como gráfica sobre la página (3:1)', () => {
    const soft = checkContrast(tema.colores).filter((r) => r.texto === 'acento_suave' || r.fondo === 'acento_suave')
    expect(soft.map((r) => [r.texto, r.fondo, r.minimo, r.pasa])).toEqual([
      ['superficie', 'acento_suave', 4.5, true],
      ['acento_suave', 'fondo', 3, true],
      ['acento_suave', 'superficie', 3, true],
    ])
    const tooLight = checkContrast({ ...tema.colores, acento_suave: '#e7c6e7' }).filter((r) => !r.pasa)
    expect(tooLight.map((r) => `${r.texto}/${r.fondo}/${r.tipo}`)).toEqual([
      'superficie/acento_suave/texto',
      'acento_suave/fondo/grafica',
      'acento_suave/superficie/grafica',
    ])
  })
})

describe('catálogo de fuentes', () => {
  it('sirve solo Archivo (display y cuerpo) y Newsreader (cita)', () => {
    expect(fontNames('display')).toEqual(['Archivo'])
    expect(fontNames('body')).toEqual(['Archivo'])
    expect(fontNames('quote')).toEqual(['Newsreader'])
    expect(isFont('Newsreader', 'display')).toBe(false)
    expect(isFont('Unbounded', 'display')).toBe(false)
  })

  it('la cita es el único lugar con serif, en itálica', () => {
    expect(family('Archivo').fallback).toMatch(/sans-serif$/)
    expect(family('Newsreader').fallback).toMatch(/serif$/)
    expect(family('Newsreader').files.every((f) => f.style === 'italic')).toBe(true)
  })

  it('Archivo: titular corto expandido en mayúsculas, largo condensado, cifras en ancho normal', () => {
    const { short, long, figure } = family('Archivo').display!
    expect(short).toMatchObject({ transform: 'uppercase', stretch: '125%', size: 0.7 })
    expect(long).toMatchObject({ transform: 'none', stretch: '70%' })
    expect(figure.stretch).toBe('100%')
    expect(family('Archivo').text!.labelStretch).toBe('125%')
  })

  it('declara la fuente variable con sus rangos de peso y ancho, con swap y woff2 local', () => {
    const css = fontFaceCss(['Archivo', 'Archivo'])
    expect(css.match(/@font-face/g)).toHaveLength(1)
    expect(css).toContain('font-weight:100 900;font-stretch:62% 125%;font-display:swap')
    expect(css).toMatch(/format\("woff2"\)/)
    expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic/)
  })

  it('declara la cita como itálica', () => {
    expect(fontFaceCss(['Newsreader'])).toContain('font-style:italic;font-weight:400')
  })

  it('precarga un archivo por familia', () => {
    expect(preloadUrls(['Archivo', 'Archivo'])).toHaveLength(1)
  })

  it('incluye la pila de respaldo y rechaza fuentes fuera del catálogo', () => {
    expect(fontStack('Archivo')).toMatch(/^"Archivo", ui-sans-serif/)
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
    expect(vars['--color-accent-soft']).toBe('#9a579a')
    expect(vars['--font-display']).toBe(fontStack('Archivo'))
    expect(vars['--font-quote']).toBe(fontStack('Newsreader'))
  })

  it('expone los estilos de titular corto, largo, cifras y etiquetas', () => {
    expect(typographyVariables(tema.tipografias)).toMatchObject({
      '--title-short-transform': 'uppercase',
      '--title-short-stretch': '125%',
      '--title-long-transform': 'none',
      '--title-long-stretch': '70%',
      '--figure-stretch': '100%',
      '--label-stretch': '125%',
      '--quote-style': 'italic',
    })
  })

  it('sin cita, la cita usa el estilo largo de la display, sin serif', () => {
    expect(typographyVariables({ display: 'Archivo', cuerpo: 'Archivo' })).toMatchObject({
      '--font-quote': fontStack('Archivo'),
      '--quote-style': 'normal',
      '--quote-stretch': '70%',
    })
  })

  it('carga solo las familias del tema', () => {
    expect(themeFonts(tema.tipografias)).toEqual(['Archivo', 'Archivo', 'Newsreader'])
    expect(themeFonts({ display: 'Archivo', cuerpo: 'Archivo' })).toEqual(['Archivo', 'Archivo'])
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
