import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { esGiroAfin } from './afines'
import { bbox, elementsIn, findLayers, frameAround, localId, prepareSvg, puntoRotulo, readFloorPlan } from './svg'

const PLANOS = path.resolve(import.meta.dirname, '../../../content/plazas/el-dorado/planos')
const pb = readFileSync(path.join(PLANOS, 'pb.svg'), 'utf8')

const minimo = (extra = '', locales = '<rect id="local-a1" data-clave="A1" x="0" y="0" width="10" height="10"/>') => `<svg viewBox="0 0 100 100">
  <g id="contorno"></g><g id="pasillos"></g><g id="locales">${locales}</g><g id="anclas"></g>
  <g id="accesos"></g><g id="estacionamiento"></g><g id="etiquetas"><text data-leyenda="">Plano esquemático, no a escala</text></g>${extra}
</svg>`

describe('localId', () => {
  it('convierte la clave en un id del contrato', () => {
    expect(localId('A25+A26')).toBe('local-a25-a26')
    expect(localId('(B1-B4)+(B17+B21)')).toBe('local-b1-b4-b17-b21')
  })
})

describe('lectura del SVG', () => {
  it('encuentra las capas aunque tengan grupos anidados', () => {
    const layers = findLayers('<svg><g id="locales"><g><rect/></g><rect/></g><g id="anclas"></g></svg>')
    expect(layers.get('locales')).toBe('<g><rect/></g><rect/>')
    expect(layers.get('anclas')).toBe('')
  })

  it('calcula la caja de rect y polygon', () => {
    const [rect, poly] = elementsIn('<rect x="1" y="2" width="3" height="4"/><polygon points="0,0 10,5 4,8"/>')
    expect(bbox(rect!)).toEqual({ x: 1, y: 2, width: 3, height: 4 })
    expect(bbox(poly!)).toEqual({ x: 0, y: 0, width: 10, height: 8 })
  })
})

describe('contrato del plano de nivel', () => {
  it('el plano de El Dorado lo cumple', () => {
    const { errors, info } = readFloorPlan(pb)
    expect(errors).toEqual([])
    expect(info!.locales.get('A25+A26')!.id).toBe('local-a25-a26')
    expect(info!.anclas.map((a) => a.marca)).toEqual(['Liverpool', 'Chedraui Selecto'])
    expect(info!.rutas).toEqual([{ id: 'ruta-estacionamiento-norte-a25-a26', desde: 'estacionamiento-norte', hasta: 'A25+A26' }])
  })

  it('acepta un plano mínimo con las capas obligatorias y sin marina', () => {
    expect(readFloorPlan(minimo()).errors).toEqual([])
  })

  it('reporta capas faltantes', () => {
    expect(readFloorPlan('<svg viewBox="0 0 1 1"><g id="locales"></g></svg>').errors).toContain(
      'faltan grupos de capa: <g id="contorno">, <g id="pasillos">, <g id="anclas">, <g id="accesos">, <g id="estacionamiento">, <g id="etiquetas">',
    )
  })

  it('exige data-clave, id local-<clave> y una forma rect o polygon', () => {
    const errors = readFloorPlan(minimo('', '<rect id="x" data-clave="A1" x="0" y="0" width="1" height="1"/><path d="M0 0" data-clave="A2" id="local-a2"/><rect id="local-a3"/>')).errors
    expect(errors).toContain('el local "A1" debe tener id="local-a1"')
    expect(errors).toContain('el local "A2" debe ser un <rect> o <polygon> válido')
    expect(errors).toContain('en "locales" todo elemento necesita data-clave (rect id="local-a3")')
  })

  it('valida los prefijos de anclas, accesos y estacionamiento', () => {
    const errors = readFloorPlan(minimo().replace('<g id="anclas"></g>', '<g id="anclas"><rect id="liverpool" x="0" y="0" width="1" height="1"/></g>')).errors
    expect(errors).toContain('en "anclas" cada elemento necesita id="ancla-…" y data-marca')
  })

  it('valida que las rutas unan un origen del plano con un local', () => {
    const errors = readFloorPlan(minimo('<g id="rutas"><path id="ruta-1" data-desde="estacionamiento-x" data-hasta="A9" d="M0 0"/></g>')).errors
    expect(errors).toContain('la ruta "ruta-1" sale de "estacionamiento-x", que no es un estacionamiento, ancla ni acceso del plano')
    expect(errors).toContain('la ruta "ruta-1" llega a "A9", que no es un local del plano')
  })

  it('rechaza scripts, manejadores de eventos y recursos externos', () => {
    const errors = readFloorPlan(minimo('<script>x</script><rect onclick="x()"/><image href="https://x.y/a.png"/>')).errors
    expect(errors).toEqual(
      expect.arrayContaining([
        'no puede contener <script>',
        'no puede contener manejadores de eventos (on…=)',
        'no puede enlazar recursos externos (href fuera del propio SVG)',
      ]),
    )
  })

  it('exige la leyenda de plano esquemático', () => {
    expect(readFloorPlan(minimo().replace(' data-leyenda=""', '')).errors[0]).toContain('debe incluir la leyenda')
  })
})

describe('puntoRotulo', () => {
  it('usa el centro de un rectángulo', () => {
    expect(puntoRotulo([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }])).toEqual({ x: 5, y: 2 })
  })

  it('en una L busca un punto dentro de la forma', () => {
    // L: brazo vertical a la izquierda y horizontal abajo; el centro de la caja queda fuera.
    const l = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 8 }, { x: 10, y: 8 }, { x: 10, y: 10 }, { x: 0, y: 10 }]
    const p = puntoRotulo(l)
    expect(p.x <= 2 || p.y >= 8).toBe(true)
  })
})

describe('prepareSvg', () => {
  it('antepone el prefijo a los ids, marca las capas y agrega atributos a los locales', () => {
    const out = prepareSvg(minimo(), { prefix: 'pi-', locales: { A1: { tabindex: '0', 'aria-label': 'Local "A1"' } } })
    expect(out).toContain('<g id="pi-locales" data-capa="locales">')
    expect(out).toContain('id="pi-local-a1" data-ref="local-a1"')
    expect(out).toContain('tabindex="0" aria-label="Local &quot;A1&quot;"')
    expect(out).toMatch(/^<svg viewBox="0 0 100 100" class="plano-svg" focusable="false">/)
  })

  it('puede recortar el viewBox y quita title y desc', () => {
    const out = prepareSvg(pb, { prefix: 'z-', viewBox: { x: 1, y: 2, width: 3, height: 4 } })
    expect(out).toContain('viewBox="1 2 3 4"')
    expect(out).not.toContain('<title>')
    expect(out).not.toContain('<desc>')
  })

  it('el mismo plano puede aparecer dos veces sin ids repetidos', () => {
    const ids = (svg: string) => [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
    const a = ids(prepareSvg(pb, { prefix: 'a-' }))
    const b = ids(prepareSvg(pb, { prefix: 'b-' }))
    expect(a.filter((id) => b.includes(id))).toEqual([])
  })
})

describe('frameAround', () => {
  const view = { x: 0, y: 0, width: 1000, height: 600 }

  it('centra la caja y respeta la proporción', () => {
    expect(frameAround({ x: 480, y: 280, width: 40, height: 40 }, view, { width: 300, ratio: 1.5 })).toEqual({ x: 350, y: 200, width: 300, height: 200 })
  })

  it('no se sale del viewBox', () => {
    expect(frameAround({ x: 0, y: 0, width: 10, height: 10 }, view, { width: 300, ratio: 1 })).toMatchObject({ x: 0, y: 0 })
  })
})

describe('giros afines', () => {
  it('compara sin mayúsculas ni acentos', () => {
    expect(esGiroAfin('Belleza', ['belleza'])).toBe(true)
    expect(esGiroAfin('cosmeticos', ['Cosméticos'])).toBe(true)
    expect(esGiroAfin('Joyería', ['Belleza', 'Moda'])).toBe(false)
    expect(esGiroAfin('Moda')).toBe(false)
  })
})
