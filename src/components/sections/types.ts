import type { ResolvedPresentation } from '../../lib/resolve'

/** Props comunes: cada sección recibe solo el modelo resuelto (con sus cálculos) y el tipo de link. */
export interface SectionProps {
  model: ResolvedPresentation
  kind: 'revision' | 'envio'
}
