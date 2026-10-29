import type { CondicionesBase, Giro } from '../../schemas'
import { isTodo } from '../todo'
import { formatPercent } from './format'
import { money, pending, type Money, type Pending, type Ratio } from './types'

// Funciones puras de CLAUDE.md §8. Ningún resultado se redondea aquí.

type Montos = Pick<CondicionesBase, 'renta_mensual' | 'mantenimiento_mensual' | 'iva'>

/** renta + mantenimiento, sin IVA. */
export function subtotalMensual(c: Montos): Money {
  return money(c.renta_mensual + c.mantenimiento_mensual, 'excluded')
}

/** subtotal × iva. */
export function ivaMensual(c: Montos): Money {
  return money(subtotalMensual(c).amount * c.iva, 'only')
}

/** subtotal + iva. */
export function totalMensual(c: Montos): Money {
  return money(subtotalMensual(c).amount + ivaMensual(c).amount, 'included')
}

/** renta / área, sin IVA. */
export function rentaPorM2(c: Pick<CondicionesBase, 'renta_mensual'>, areaM2: number): Money {
  return money(c.renta_mensual / areaM2, 'excluded')
}

/** mantenimiento / área, sin IVA. */
export function mantenimientoPorM2(c: Pick<CondicionesBase, 'mantenimiento_mensual'>, areaM2: number): Money {
  return money(c.mantenimiento_mensual / areaM2, 'excluded')
}

/** (renta + mantenimiento si incluye_mantenimiento) × meses × (1 + iva si incluye_iva). */
export function deposito(c: Pick<CondicionesBase, 'renta_mensual' | 'mantenimiento_mensual' | 'iva' | 'deposito'>): Money {
  const { meses, incluye_mantenimiento, incluye_iva } = c.deposito
  const base = c.renta_mensual + (incluye_mantenimiento ? c.mantenimiento_mensual : 0)
  const amount = base * meses * (incluye_iva ? 1 + c.iva : 1)
  const composicion = `${meses} ${meses === 1 ? 'mes' : 'meses'} de renta${incluye_mantenimiento ? ' y mantenimiento' : ', sin mantenimiento'}`
  return money(amount, incluye_iva ? 'included' : 'excluded', [composicion])
}

/** subtotal (sin IVA) / ventas mensuales del escenario. Pendiente si las ventas están en TODO. */
export function costoOcupacionPct(c: Montos, ventasMensuales: number | string): Ratio | Pending {
  if (isTodo(ventasMensuales) || typeof ventasMensuales !== 'number') {
    return pending('ventas mensuales del escenario pendientes')
  }
  return { kind: 'ratio', value: subtotalMensual(c).amount / ventasMensuales, vat: 'excluded' }
}

/** subtotal / costo_ocupacion_objetivo.max del giro. Pendiente si el rango del giro está en TODO. */
export function ventasEquilibrio(c: Montos, giro: Pick<Giro, 'costo_ocupacion_objetivo'>): Money | Pending {
  const { max } = giro.costo_ocupacion_objetivo
  if (isTodo(max) || typeof max !== 'number') return pending('costo de ocupación objetivo del giro pendiente de validar')
  return money(subtotalMensual(c).amount / max, 'excluded', [
    `Ventas mensuales sin IVA para que el costo de ocupación sea ${formatPercent(max)}`,
  ])
}

/**
 * totalMensual × 12 para el año `anio` del contrato (1 = primer año).
 * Meses de gracia: eximen la renta desde el primer mes; el mantenimiento se paga.
 * Incremento anual: aplica a la renta desde el año 2, compuesto por año. Si es por
 * INPC, el resultado es una estimación con la tasa supuesta en `valor`.
 */
export function costoAnual(
  c: Pick<CondicionesBase, 'renta_mensual' | 'mantenimiento_mensual' | 'iva' | 'meses_gracia' | 'incremento_anual'>,
  anio = 1,
): Money {
  if (!Number.isInteger(anio) || anio < 1) throw new RangeError('anio debe ser un entero mayor o igual a 1')

  const gracia = c.meses_gracia ?? 0
  const incremento = c.incremento_anual
  const factor = (1 + (incremento?.valor ?? 0)) ** (anio - 1)

  let amount = 0
  for (let i = 0; i < 12; i++) {
    const mes = (anio - 1) * 12 + i
    const renta = mes < gracia ? 0 : c.renta_mensual * factor
    amount += (renta + c.mantenimiento_mensual) * (1 + c.iva)
  }

  const assumptions: string[] = []
  const mesesSinRenta = Math.max(0, Math.min(12, gracia - (anio - 1) * 12))
  if (mesesSinRenta > 0) {
    assumptions.push(`${mesesSinRenta} ${mesesSinRenta === 1 ? 'mes' : 'meses'} de gracia sin renta; el mantenimiento se paga`)
  }
  const aplicaIncremento = incremento !== undefined && anio > 1 && incremento.valor > 0
  if (aplicaIncremento && incremento.tipo === 'fijo') {
    assumptions.push(`Incremento fijo de ${formatPercent(incremento.valor)} anual sobre la renta a partir del año 2`)
  }
  if (aplicaIncremento && incremento.tipo === 'inpc') {
    assumptions.push(
      `Estimación: incremento por INPC supuesto en ${formatPercent(incremento.valor)} anual sobre la renta a partir del año 2; el INPC real puede variar`,
    )
  }
  return money(amount, 'included', assumptions, aplicaIncremento && incremento.tipo === 'inpc')
}

export type RangoEstado = 'below' | 'within' | 'above'

export interface RangoResult {
  kind: 'range'
  estado: RangoEstado
  min: number
  max: number
}

/**
 * Ubica un costo de ocupación respecto al rango sano del giro (costo_ocupacion_objetivo).
 * below: por debajo del mínimo (más holgado); within: dentro; above: por encima del máximo.
 * Pendiente si el costo o el rango del giro están en TODO.
 */
export function evaluarRango(
  costo: Ratio | Pending,
  giro: Pick<Giro, 'costo_ocupacion_objetivo'>,
): RangoResult | Pending {
  if (costo.kind === 'pending') return costo
  const { min, max } = giro.costo_ocupacion_objetivo
  if (typeof min !== 'number' || typeof max !== 'number') {
    return pending('costo de ocupación objetivo del giro pendiente de validar')
  }
  const estado: RangoEstado = costo.value < min ? 'below' : costo.value > max ? 'above' : 'within'
  return { kind: 'range', estado, min, max }
}
