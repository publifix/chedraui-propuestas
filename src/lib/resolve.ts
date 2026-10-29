import type { Content } from './content'
import {
  SECCIONES,
  type Asesor,
  type CondicionesBase,
  type Giro,
  type Local,
  type Plaza,
  type Presentacion,
  type Seccion,
} from '../schemas'

export interface ResolvedLocal extends Local {
  /** condiciones_base del local con las sobrescrituras de la presentación aplicadas. */
  condiciones: CondicionesBase
}

export interface ResolvedPresentation
  extends Pick<Presentacion, 'id' | 'tokens' | 'prospecto' | 'vigencia' | 'escenarios_venta' | 'narrativa' | 'seo'> {
  plaza: Plaza
  locales: ResolvedLocal[]
  giro: Giro
  asesor: Asesor & { slug: string }
  secciones: Seccion[]
}

/**
 * Sobrescribe condiciones_base campo por campo con las de la presentación.
 * Los campos objeto (deposito, incremento_anual) se reemplazan completos.
 */
export function mergeCondiciones(
  base: CondicionesBase,
  override: Presentacion['condiciones'] = {},
): CondicionesBase {
  const defined = Object.entries(override).filter(([, value]) => value !== undefined)
  return { ...base, ...Object.fromEntries(defined) }
}

/** Fusiona plaza → local → presentación en el modelo que reciben las secciones. Sin cálculos. */
export function resolvePresentation(content: Content, id: string): ResolvedPresentation {
  const p = content.presentaciones.get(id)
  if (!p) throw new Error(`la presentación "${id}" no existe`)

  // buildContent ya garantizó que las referencias existen.
  const plazaEntry = content.plazas.get(p.plaza)!
  const asesor = content.asesores.get(p.asesor)!

  return {
    id: p.id,
    tokens: p.tokens,
    prospecto: p.prospecto,
    vigencia: p.vigencia,
    escenarios_venta: p.escenarios_venta,
    narrativa: p.narrativa,
    seo: p.seo,
    plaza: plazaEntry.plaza,
    locales: p.locales.map((clave) => {
      const { local } = plazaEntry.locales.get(clave)!
      return { ...local, condiciones: mergeCondiciones(local.condiciones_base, p.condiciones) }
    }),
    giro: content.giros.get(p.prospecto.giro)!,
    asesor: { ...asesor, slug: p.asesor },
    secciones: p.secciones ?? [...SECCIONES],
  }
}

export function resolveAll(content: Content): ResolvedPresentation[] {
  return [...content.presentaciones.keys()].map((id) => resolvePresentation(content, id))
}
