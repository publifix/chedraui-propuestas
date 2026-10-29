import { describe, expect, it } from 'vitest'
import { buildContent } from './content'
import { mergeCondiciones, resolveAll, resolvePresentation } from './resolve'
import { editYaml, SEED, seedFiles } from './test-utils'
import { SECCIONES, type CondicionesBase } from '../schemas'

const ID = '2026-11-rubi-perfumeria-a25-a26'

const base: CondicionesBase = {
  renta_mensual: 17000,
  mantenimiento_mensual: 2550,
  iva: 0.16,
  deposito: { meses: 1, incluye_mantenimiento: false, incluye_iva: true },
  plazo_minimo_meses: 36,
}

describe('mergeCondiciones', () => {
  it('sin sobrescrituras devuelve las condiciones base', () => {
    expect(mergeCondiciones(base)).toEqual(base)
    expect(mergeCondiciones(base, {})).toEqual(base)
  })

  it('sobrescribe solo los campos definidos', () => {
    expect(mergeCondiciones(base, { renta_mensual: 15000, meses_gracia: 2 })).toEqual({
      ...base,
      renta_mensual: 15000,
      meses_gracia: 2,
    })
  })

  it('ignora campos con valor undefined', () => {
    expect(mergeCondiciones(base, { renta_mensual: undefined })).toEqual(base)
  })

  it('reemplaza los objetos completos, sin fusión profunda', () => {
    const deposito = { meses: 2, incluye_mantenimiento: true, incluye_iva: false }
    expect(mergeCondiciones(base, { deposito }).deposito).toEqual(deposito)
  })

  it('no modifica las condiciones base', () => {
    const copy = structuredClone(base)
    mergeCondiciones(base, { renta_mensual: 1 })
    expect(base).toEqual(copy)
  })
})

describe('resolvePresentation', () => {
  it('fusiona plaza, local, giro y asesor de la semilla', () => {
    const model = resolvePresentation(buildContent(seedFiles()), ID)
    expect(model.plaza.slug).toBe('el-dorado')
    expect(model.locales.map((l) => l.clave)).toEqual(['A25+A26'])
    expect(model.locales[0]!.condiciones).toEqual(model.locales[0]!.condiciones_base)
    expect(model.giro.slug).toBe('perfumeria')
    expect(model.asesor.slug).toBe('demo')
    expect(model.secciones).toEqual([...SECCIONES])
  })

  it('aplica las condiciones de la presentación a cada local y nada más', () => {
    const files = editYaml(seedFiles(), SEED.presentacion, (d) => {
      d['condiciones'] = { renta_mensual: 15000 }
    })
    const content = buildContent(files)
    const original = content.plazas.get('el-dorado')!.locales.get('A25+A26')!.local
    const [local] = resolvePresentation(content, ID).locales

    expect(local!.condiciones).toEqual({ ...original.condiciones_base, renta_mensual: 15000 })
    // El resto del local y sus condiciones_base quedan intactos.
    expect(local!.condiciones_base).toEqual(original.condiciones_base)
    const { condiciones: _, ...rest } = local!
    expect(rest).toEqual(original)
  })

  it('respeta el orden de secciones definido en la presentación', () => {
    const files = editYaml(seedFiles(), SEED.presentacion, (d) => (d['secciones'] = ['Portada', 'Condiciones', 'Cierre']))
    expect(resolvePresentation(buildContent(files), ID).secciones).toEqual(['Portada', 'Condiciones', 'Cierre'])
  })

  it('lanza un error claro con un id inexistente', () => {
    expect(() => resolvePresentation(buildContent(seedFiles()), 'no-existe')).toThrow('la presentación "no-existe" no existe')
  })

  it('resolveAll resuelve todas las presentaciones', () => {
    expect(resolveAll(buildContent(seedFiles())).map((p) => p.id)).toEqual([ID])
  })
})
