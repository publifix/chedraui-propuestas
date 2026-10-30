import type { Content, DemoMark } from './content'
import { calcularLocal, type LocalCalculations } from './calc'
import { findFotosPendientes, findVisibleTodos, type TodoValue } from './todos'
import type { FloorPlanInfo, RegionMapInfo } from './plano/svg'
import {
  condicionesDeLocal,
  SECCIONES,
  type Asesor,
  type CondicionesBase,
  type CondicionesOverride,
  type Giro,
  type Local,
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
  /** Valores TODO que vería el prospecto (sin fotos). Bloquean "lista"; solo se ven en revisión. */
  pendientes: TodoValue[]
  /** Fotos que faltan. No bloquean "lista": en revisión se listan y en envío hay composiciones. */
  fotosPendientes: TodoValue[]
  /** Valores marcados `# DEMO` en los archivos de la presentación. Solo se cuentan en revisión. */
  demos: DemoMark[]
}

export interface ResolvedFloorPlan {
  nivel: { id: string; nombre: string }
  svg: string
  info: FloorPlanInfo
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

  const model: Omit<ResolvedPresentation, 'pendientes' | 'fotosPendientes' | 'demos'> = {
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
      // Los ocupantes se leen de plaza.niveles (ocupantesDe): una sola fuente de verdad.
      return [{ nivel: { id: nivel.id, nombre: nivel.nombre }, svg: plan.svg, info: plan.info, claves }]
    }),
    ...(plazaEntry.region && { region: { svg: plazaEntry.region.svg, info: plazaEntry.region.info } }),
  }
  // Archivos de los que sale la presentación: plaza, sus locales, giro, asesor y la presentación.
  const archivos = [
    plazaEntry.file,
    ...p.locales.map((clave) => plazaEntry.locales.get(clave)!.file),
    content.archivos.get(`giros/${p.prospecto.giro}`),
    content.archivos.get(`asesores/${p.asesor}`),
    content.archivos.get(`presentaciones/${p.id}`),
  ]
  return {
    ...model,
    pendientes: findVisibleTodos(model, secciones),
    fotosPendientes: findFotosPendientes(model, secciones),
    demos: archivos.flatMap((file) => (file ? (content.demos.get(file) ?? []) : [])),
  }
}

/** Ocupantes del nivel de un plano, tal como están en plaza.niveles. */
export function ocupantesDe(model: Pick<ResolvedPresentation, 'plaza'>, nivelId: string) {
  return model.plaza.niveles.find((n) => n.id === nivelId)?.ocupantes ?? []
}

/** Vecinos de un local con la marca y el giro de su ocupante (o el local de la presentación). */
export function vecinosDe(model: Pick<ResolvedPresentation, 'plaza' | 'locales' | 'prospecto'>, local: Pick<Local, 'nivel' | 'vecinos'>) {
  const ocupantes = ocupantesDe(model, local.nivel)
  return (local.vecinos ?? []).map((clave) => {
    const o = ocupantes.find((x) => x.clave === clave)
    if (o) return { clave, marca: o.marca, giro: o.giro }
    const propio = model.locales.some((l) => l.clave === clave)
    return { clave, marca: propio ? `Local para ${model.prospecto.marca}` : 'Local disponible', giro: undefined }
  })
}

export function resolveAll(content: Content): ResolvedPresentation[] {
  return [...content.presentaciones.keys()].map((id) => resolvePresentation(content, id))
}
