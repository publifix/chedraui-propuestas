import type { Content } from './content'
import { calcularLocal, type LocalCalculations } from './calc'
import { findVisibleTodos, type TodoValue } from './todos'
import type { FloorPlanInfo, RegionMapInfo } from './plano/svg'
import {
  condicionesDeLocal,
  SECCIONES,
  type Asesor,
  type CondicionesBase,
  type CondicionesOverride,
  type Giro,
  type Local,
  type Ocupante,
  type Plaza,
  type Presentacion,
  type Seccion,
} from '../schemas'

export interface ResolvedLocal extends Local {
  /** condiciones_base del local con las sobrescrituras de la presentación aplicadas. */
  condiciones: CondicionesBase
  calculos: LocalCalculations
}

export interface ResolvedPresentation
  extends Pick<
    Presentacion,
    'id' | 'estado' | 'tokens' | 'prospecto' | 'vigencia' | 'escenarios_venta' | 'narrativa' | 'seo'
  > {
  plaza: Plaza
  locales: ResolvedLocal[]
  giro: Giro
  asesor: Asesor & { slug: string }
  secciones: Seccion[]
  /** Plano de cada nivel donde están los locales de la presentación (si ya existe). */
  planos: ResolvedFloorPlan[]
  /** Mapa ilustrativo de la región, para la secuencia de zoom. */
  region?: { svg: string; info: RegionMapInfo }
  /** Valores TODO que vería el prospecto. Se muestran solo en el link de revisión. */
  pendientes: TodoValue[]
}

export interface ResolvedFloorPlan {
  nivel: { id: string; nombre: string }
  svg: string
  info: FloorPlanInfo
  ocupantes: Ocupante[]
  /** Claves de los locales de la presentación en este nivel. */
  claves: string[]
}

/**
 * Sobrescribe condiciones_base campo por campo con las de la presentación.
 * Los campos objeto (deposito, incremento_anual) se reemplazan completos.
 */
export function mergeCondiciones(base: CondicionesBase, override: CondicionesOverride = {}): CondicionesBase {
  const defined = Object.entries(override).filter(([, value]) => value !== undefined)
  return { ...base, ...Object.fromEntries(defined) }
}

/** Fusiona plaza → local → presentación y calcula los montos de cada local. */
export function resolvePresentation(content: Content, id: string): ResolvedPresentation {
  const p = content.presentaciones.get(id)
  if (!p) throw new Error(`la presentación "${id}" no existe`)

  // buildContent ya garantizó que las referencias existen.
  const plazaEntry = content.plazas.get(p.plaza)!
  const asesor = content.asesores.get(p.asesor)!
  const giro = content.giros.get(p.prospecto.giro)!
  const secciones = p.secciones ?? [...SECCIONES]

  const model: Omit<ResolvedPresentation, 'pendientes'> = {
    id: p.id,
    estado: p.estado,
    tokens: p.tokens,
    prospecto: p.prospecto,
    vigencia: p.vigencia,
    escenarios_venta: p.escenarios_venta,
    narrativa: p.narrativa,
    seo: p.seo,
    plaza: plazaEntry.plaza,
    locales: p.locales.map((clave) => {
      const { local } = plazaEntry.locales.get(clave)!
      const condiciones = mergeCondiciones(local.condiciones_base, condicionesDeLocal(p, clave))
      return { ...local, condiciones, calculos: calcularLocal(condiciones, local.area_m2, p.escenarios_venta, giro) }
    }),
    giro,
    asesor: { ...asesor, slug: p.asesor },
    secciones,
    planos: plazaEntry.plaza.niveles.flatMap((nivel) => {
      const plan = plazaEntry.planos.get(nivel.id)
      const claves = p.locales.filter((clave) => plazaEntry.locales.get(clave)!.local.nivel === nivel.id)
      if (!plan || claves.length === 0) return []
      return [{ nivel: { id: nivel.id, nombre: nivel.nombre }, svg: plan.svg, info: plan.info, ocupantes: nivel.ocupantes ?? [], claves }]
    }),
    ...(plazaEntry.region && { region: { svg: plazaEntry.region.svg, info: plazaEntry.region.info } }),
  }
  return { ...model, pendientes: findVisibleTodos(model, secciones) }
}

export function resolveAll(content: Content): ResolvedPresentation[] {
  return [...content.presentaciones.keys()].map((id) => resolvePresentation(content, id))
}
