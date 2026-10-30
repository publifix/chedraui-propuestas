import { describe, expect, it } from 'vitest'
import { buildContent } from './content'
import { mergeCondiciones, resolveAll, resolvePresentation } from './resolve'
import { editYaml, readYaml, SEED, seedFiles, semillaEnBorrador } from './test-utils'
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
    expect(model.asesor.slug).toBe('mariana-ortega')
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
    const { condiciones: _c, calculos: _k, ...rest } = local!
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

/** Semilla con un segundo local (A27) en la plaza y la presentación como comparativa. */
function comparativa(condiciones?: unknown) {
  const files = seedFiles()
  const segundo = readYaml(files, SEED.local)
  // A22 está dibujado en el plano de la semilla; su archivo de local sustituye al ocupante.
  segundo['clave'] = 'A22'
  segundo['plano_ref'] = 'local-a22'
  delete segundo['ruta']
  delete segundo['vecinos']
  segundo['area_m2'] = 60
  segundo['condiciones_base'].renta_mensual = 14000
  files.set('plazas/el-dorado/locales/a22.yaml', JSON.stringify(segundo))
  return editYaml(files, SEED.presentacion, (d) => {
    d['locales'] = ['A25+A26', 'A22']
    if (condiciones !== undefined) d['condiciones'] = condiciones
  })
}

describe('condiciones por local (comparativa)', () => {
  it('aplica a cada local solo las condiciones de su clave', () => {
    const files = comparativa({ 'A25+A26': { renta_mensual: 16000 }, A22: { meses_gracia: 2 } })
    const [a25, a22] = resolvePresentation(buildContent(files), ID).locales
    expect(a25!.condiciones.renta_mensual).toBe(16000)
    expect(a25!.condiciones.meses_gracia).toBe(a25!.condiciones_base.meses_gracia)
    expect(a22!.condiciones.renta_mensual).toBe(14000)
    expect(a22!.condiciones.meses_gracia).toBe(2)
  })

  it('un local sin clave en condiciones conserva sus condiciones base', () => {
    const files = comparativa({ A22: { renta_mensual: 13000 } })
    const [a25, a22] = resolvePresentation(buildContent(files), ID).locales
    expect(a25!.condiciones).toEqual(a25!.condiciones_base)
    expect(a22!.condiciones.renta_mensual).toBe(13000)
  })

  it('calcula los montos de cada local con sus propias condiciones', () => {
    const files = comparativa({ A22: { renta_mensual: 13000 } })
    const [a25, a22] = resolvePresentation(buildContent(files), ID).locales
    expect(a25!.calculos.subtotalMensual.amount).toBe(19550)
    expect(a22!.calculos.subtotalMensual.amount).toBe(15550)
  })
})

describe('modelo resuelto', () => {
  it('conecta los cálculos con las condiciones resueltas', () => {
    const files = editYaml(seedFiles(), SEED.presentacion, (d) => (d['condiciones'] = { renta_mensual: 15000 }))
    const [local] = resolvePresentation(buildContent(files), ID).locales
    expect(local!.calculos.subtotalMensual).toMatchObject({ amount: 17550, vat: 'excluded' })
    expect(local!.calculos.deposito).toMatchObject({ amount: 15000 * 1.16, vat: 'included' })
  })

  it('marca como pendientes los cálculos que dependen de TODO', () => {
    const [local] = resolvePresentation(buildContent(semillaEnBorrador()), ID).locales
    expect(local!.calculos.ventasEquilibrio.kind).toBe('pending')
    expect(local!.calculos.escenarios.map((e) => e.costoOcupacion.kind)).toEqual(['pending', 'pending', 'pending'])
  })

  it('lista los TODO visibles para el link de revisión', () => {
    const model = resolvePresentation(buildContent(semillaEnBorrador()), ID)
    expect(model.estado).toBe('borrador')
    const paths = model.pendientes.map((t) => t.path)
    expect(paths).toContain('plaza.frase_principal')
    expect(paths).toContain('narrativa.cierre')
    expect(paths).toContain('giro.costo_ocupacion_objetivo.max')
    expect(paths).not.toContain('tokens.envio')
  })

  it('los ocupantes viven solo en plaza.niveles: un TODO de ocupante se lista una vez', () => {
    const files = editYaml(semillaEnBorrador(), SEED.plaza, (d) => (d['niveles'][0].ocupantes[0].marca = 'TODO: marca del ocupante'))
    const model = resolvePresentation(buildContent(files), ID)
    expect(model.planos[0]).not.toHaveProperty('ocupantes')
    const ocupante = model.pendientes.filter((t) => t.text === 'TODO: marca del ocupante')
    expect(ocupante.map((t) => t.path)).toEqual(['plaza.niveles.0.ocupantes.0.marca'])
  })

  it('Rubí, con datos completos, solo deja fotos pendientes', () => {
    const model = resolvePresentation(buildContent(seedFiles()), ID)
    expect(model.pendientes).toEqual([])
    expect(model.fotosPendientes.map((f) => f.path)).toEqual(
      expect.arrayContaining(['plaza.diferenciales.4.imagen', 'plaza.modulos.1.imagen', 'locales.0.media.fotos']),
    )
  })

  it('verifica los números del business case de Rubí con el módulo de cálculos', () => {
    const [local] = resolvePresentation(buildContent(seedFiles()), ID).locales
    const c = local!.calculos
    expect(c.subtotalMensual.amount).toBe(19550)
    const pct = c.escenarios.map((e) => (e.costoOcupacion.kind === 'ratio' ? +(e.costoOcupacion.value * 100).toFixed(2) : null))
    expect(pct).toEqual([10.86, 7.52, 5.14])
    expect(c.ventasEquilibrio.kind === 'money' && c.ventasEquilibrio.amount).toBeCloseTo(162916.67, 2)
  })

  it('cuenta los valores # DEMO de los archivos de la presentación', () => {
    const model = resolvePresentation(buildContent(seedFiles()), ID)
    expect(model.demos.length).toBeGreaterThan(0)
    const archivos = new Set(model.demos.map((d) => d.file))
    expect(archivos).toEqual(
      new Set([`content/${SEED.plaza}`, `content/${SEED.local}`, `content/${SEED.giro}`, `content/${SEED.asesor}`, `content/${SEED.presentacion}`]),
    )
  })
})
