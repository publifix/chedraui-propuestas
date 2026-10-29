import type { CondicionesBase, Giro, Presentacion } from '../../schemas'
import { isTodo } from '../todo'
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
import { money, pending, type Money, type Pending, type Ratio } from './types'

export * from './calc'
export * from './format'
export * from './types'

export interface EscenarioCalculado {
  nombre: string
  ventasMensuales: Money | Pending
  costoOcupacion: Ratio | Pending
}

export interface LocalCalculations {
  subtotalMensual: Money
  ivaMensual: Money
  totalMensual: Money
  rentaPorM2: Money
  mantenimientoPorM2: Money
  deposito: Money
  /** Primer año del contrato. */
  costoAnual: Money
  escenarios: EscenarioCalculado[]
  ventasEquilibrio: Money | Pending
}

/** Todos los cálculos de un local con sus condiciones ya resueltas. */
export function calcularLocal(
  condiciones: CondicionesBase,
  areaM2: number,
  escenarios: Presentacion['escenarios_venta'],
  giro: Giro,
): LocalCalculations {
  return {
    subtotalMensual: subtotalMensual(condiciones),
    ivaMensual: ivaMensual(condiciones),
    totalMensual: totalMensual(condiciones),
    rentaPorM2: rentaPorM2(condiciones, areaM2),
    mantenimientoPorM2: mantenimientoPorM2(condiciones, areaM2),
    deposito: deposito(condiciones),
    costoAnual: costoAnual(condiciones),
    escenarios: escenarios.map(({ nombre, ventas_mensuales }) => ({
      nombre,
      ventasMensuales: isTodo(ventas_mensuales) || typeof ventas_mensuales !== 'number'
        ? pending('ventas mensuales del escenario pendientes')
        : money(ventas_mensuales, 'excluded'),
      costoOcupacion: costoOcupacionPct(condiciones, ventas_mensuales),
    })),
    ventasEquilibrio: ventasEquilibrio(condiciones, giro),
  }
}
