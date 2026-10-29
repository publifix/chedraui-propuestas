import { describe, expect, it } from 'vitest'
import type { CondicionesBase } from '../../schemas'
import {
  costoAnual,
  costoOcupacionPct,
  deposito,
  ivaMensual,
  mantenimientoPorM2,
  rentaPorM2,
  subtotalMensual,
  totalMensual,
  ventasEquilibrio,
} from './calc'
import { calcularLocal } from '.'

// Local A25+A26 de El Dorado (PDF de Chedraui, junio 2026).
const AREA_M2 = 77.76
const elDorado: CondicionesBase = {
  renta_mensual: 17000,
  mantenimiento_mensual: 2550,
  iva: 0.16,
  deposito: { meses: 1, incluye_mantenimiento: false, incluye_iva: true },
}

const pendingTodo = 'TODO: validar con fuente'

describe('montos mensuales', () => {
  it('subtotalMensual = renta + mantenimiento, sin IVA', () => {
    expect(subtotalMensual(elDorado)).toMatchObject({ amount: 19550, vat: 'excluded' })
  })

  it('ivaMensual = subtotal × IVA', () => {
    expect(ivaMensual(elDorado).amount).toBeCloseTo(3128, 10)
    expect(ivaMensual(elDorado).vat).toBe('only')
  })

  it('totalMensual = subtotal + IVA, con IVA incluido', () => {
    expect(totalMensual(elDorado).amount).toBeCloseTo(22678, 10)
    expect(totalMensual(elDorado).vat).toBe('included')
  })
})

describe('montos por m²', () => {
  it('rentaPorM2 no redondea', () => {
    const { amount, vat } = rentaPorM2(elDorado, AREA_M2)
    expect(amount).toBe(17000 / 77.76)
    expect(amount).toBeCloseTo(218.6214, 4)
    expect(vat).toBe('excluded')
  })

  it('mantenimientoPorM2 no redondea', () => {
    const { amount, vat } = mantenimientoPorM2(elDorado, AREA_M2)
    expect(amount).toBe(2550 / 77.76)
    expect(amount).toBeCloseTo(32.7932, 4)
    expect(vat).toBe('excluded')
  })
})

describe('deposito (caso conocido de El Dorado, CLAUDE.md §8)', () => {
  it('con la regla configurada (1 mes de renta con IVA, sin mantenimiento) da 19,720', () => {
    const result = deposito(elDorado)
    expect(result.amount).toBeCloseTo(19720, 10)
    expect(result.vat).toBe('included')
    expect(result.assumptions).toEqual(['1 mes de renta, sin mantenimiento'])
  })

  it('con renta + mantenimiento + IVA, como dice el texto del PDF, daría 22,678', () => {
    const result = deposito({ ...elDorado, deposito: { meses: 1, incluye_mantenimiento: true, incluye_iva: true } })
    expect(result.amount).toBeCloseTo(22678, 10)
    expect(result.assumptions).toEqual(['1 mes de renta y mantenimiento'])
  })

  it('sin IVA y con varios meses', () => {
    const result = deposito({ ...elDorado, deposito: { meses: 2, incluye_mantenimiento: true, incluye_iva: false } })
    expect(result).toMatchObject({ amount: 39100, vat: 'excluded' })
  })
})

describe('costoOcupacionPct', () => {
  it('= subtotal sin IVA / ventas mensuales del escenario', () => {
    const result = costoOcupacionPct(elDorado, 200000)
    expect(result).toEqual({ kind: 'ratio', value: 19550 / 200000, vat: 'excluded' })
  })

  it('es pendiente si las ventas están en TODO', () => {
    expect(costoOcupacionPct(elDorado, 'TODO: ventas mensuales')).toEqual({
      kind: 'pending',
      reason: 'ventas mensuales del escenario pendientes',
    })
  })
})

describe('ventasEquilibrio', () => {
  it('= subtotal / costo de ocupación máximo del giro', () => {
    const result = ventasEquilibrio(elDorado, { costo_ocupacion_objetivo: { min: 0.08, max: 0.1 } })
    expect(result).toMatchObject({ kind: 'money', amount: 195500, vat: 'excluded' })
  })

  it('es pendiente si el rango del giro está en TODO', () => {
    expect(ventasEquilibrio(elDorado, { costo_ocupacion_objetivo: { min: pendingTodo, max: pendingTodo } })).toEqual({
      kind: 'pending',
      reason: 'costo de ocupación objetivo del giro pendiente de validar',
    })
  })
})

describe('costoAnual', () => {
  it('sin gracia ni incremento = totalMensual × 12, con IVA incluido', () => {
    const result = costoAnual(elDorado)
    expect(result.amount).toBeCloseTo(22678 * 12, 8)
    expect(result).toMatchObject({ vat: 'included', estimate: false, assumptions: [] })
  })

  it('aplica meses de gracia sobre la renta; el mantenimiento se paga', () => {
    const result = costoAnual({ ...elDorado, meses_gracia: 2 })
    const conGracia = 2550 * 1.16 * 2 + 22678 * 10
    expect(result.amount).toBeCloseTo(conGracia, 8)
    expect(result.amount).toBeCloseTo(232696, 8)
    expect(result.assumptions).toEqual(['2 meses de gracia sin renta; el mantenimiento se paga'])
  })

  it('la gracia mayor a 12 meses continúa en el año 2', () => {
    const c = { ...elDorado, meses_gracia: 14 }
    expect(costoAnual(c, 1).amount).toBeCloseTo(2550 * 1.16 * 12, 8)
    expect(costoAnual(c, 2).amount).toBeCloseTo(2550 * 1.16 * 2 + 22678 * 10, 8)
    expect(costoAnual(c, 3).assumptions).toEqual([])
  })

  it('el incremento fijo no cambia el primer año', () => {
    const c: CondicionesBase = { ...elDorado, incremento_anual: { tipo: 'fijo', valor: 0.05 } }
    expect(costoAnual(c, 1).amount).toBeCloseTo(22678 * 12, 8)
    expect(costoAnual(c, 1).assumptions).toEqual([])
  })

  it('aplica el incremento fijo a la renta desde el año 2, compuesto', () => {
    const c: CondicionesBase = { ...elDorado, incremento_anual: { tipo: 'fijo', valor: 0.05 } }
    expect(costoAnual(c, 2).amount).toBeCloseTo((17000 * 1.05 + 2550) * 1.16 * 12, 8)
    expect(costoAnual(c, 2).amount).toBeCloseTo(283968, 8)
    expect(costoAnual(c, 3).amount).toBeCloseTo((17000 * 1.05 ** 2 + 2550) * 1.16 * 12, 8)
    expect(costoAnual(c, 2)).toMatchObject({
      estimate: false,
      assumptions: ['Incremento fijo de 5% anual sobre la renta a partir del año 2'],
    })
  })

  it('con INPC es una estimación con el supuesto explícito', () => {
    const c: CondicionesBase = { ...elDorado, incremento_anual: { tipo: 'inpc', valor: 0.045 } }
    const result = costoAnual(c, 2)
    expect(result.amount).toBeCloseTo((17000 * 1.045 + 2550) * 1.16 * 12, 8)
    expect(result.estimate).toBe(true)
    expect(result.assumptions).toEqual([
      'Estimación: incremento por INPC supuesto en 4.5% anual sobre la renta a partir del año 2; el INPC real puede variar',
    ])
  })

  it('combina gracia e incremento', () => {
    const c: CondicionesBase = { ...elDorado, meses_gracia: 1, incremento_anual: { tipo: 'fijo', valor: 0.05 } }
    expect(costoAnual(c, 1).amount).toBeCloseTo(2550 * 1.16 + 22678 * 11, 8)
    expect(costoAnual(c, 2).amount).toBeCloseTo(283968, 8)
  })

  it('rechaza un año inválido', () => {
    expect(() => costoAnual(elDorado, 0)).toThrow(RangeError)
    expect(() => costoAnual(elDorado, 1.5)).toThrow(RangeError)
  })
})

describe('calcularLocal', () => {
  const escenarios = [
    { nombre: 'Conservador', ventas_mensuales: 'TODO: ventas mensuales' },
    { nombre: 'Base', ventas_mensuales: 250000 },
    { nombre: 'Optimista', ventas_mensuales: 400000 },
  ]
  const giro = { slug: 'perfumeria', nombre: 'Perfumería', costo_ocupacion_objetivo: { min: pendingTodo, max: pendingTodo } }

  it('reúne todos los cálculos del local', () => {
    const result = calcularLocal(elDorado, AREA_M2, escenarios, giro)
    expect(result.subtotalMensual.amount).toBe(19550)
    expect(result.totalMensual.amount).toBeCloseTo(22678, 10)
    expect(result.deposito.amount).toBeCloseTo(19720, 10)
    expect(result.costoAnual.amount).toBeCloseTo(272136, 8)
    expect(result.ventasEquilibrio.kind).toBe('pending')
  })

  it('calcula cada escenario y deja pendiente el que está en TODO', () => {
    const [conservador, base, optimista] = calcularLocal(elDorado, AREA_M2, escenarios, giro).escenarios
    expect(conservador).toMatchObject({ nombre: 'Conservador', ventasMensuales: { kind: 'pending' }, costoOcupacion: { kind: 'pending' } })
    expect(base!.ventasMensuales).toMatchObject({ amount: 250000, vat: 'excluded' })
    expect(base!.costoOcupacion).toMatchObject({ value: 19550 / 250000 })
    expect(optimista!.costoOcupacion).toMatchObject({ value: 19550 / 400000 })
  })
})
