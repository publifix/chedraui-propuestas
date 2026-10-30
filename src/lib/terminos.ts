// Términos del contrato de un local, como filas para mostrar: los usan la sección Condiciones y el PDF.
import { formatPercent } from './calc/format'
import type { CondicionesBase } from '../schemas'

export type Termino = [etiqueta: string, valor: string, detalle?: string]

export function terminosContrato(cond: CondicionesBase): Termino[] {
  const inc = cond.incremento_anual
  const terminos: Array<Termino | undefined> = [
    cond.plazo_minimo_meses ? ['Plazo mínimo', `${cond.plazo_minimo_meses} meses`] : undefined,
    cond.meses_gracia ? ['Meses de gracia', `${cond.meses_gracia} ${cond.meses_gracia === 1 ? 'mes' : 'meses'} sin renta`] : undefined,
    inc
      ? inc.tipo === 'inpc'
        ? ['Incremento anual', 'Según INPC', `Estimado en ${formatPercent(inc.valor)} sobre la renta a partir del año 2`]
        : ['Incremento anual', formatPercent(inc.valor), 'Sobre la renta a partir del año 2']
      : undefined,
    cond.giros_permitidos?.length ? ['Giros permitidos', cond.giros_permitidos.join(', ')] : undefined,
  ]
  return terminos.filter((t): t is Termino => t !== undefined)
}
