import type { Presentacion } from '../schemas'

export interface PresentationRoute {
  kind: 'revision' | 'envio'
  token: string
  /** Relativa al base del sitio; usar con withBase(). */
  path: string
}

/** Rutas que se generan: revisión siempre; envío solo cuando la presentación está "lista". */
export function presentationRoutes(p: Pick<Presentacion, 'estado' | 'tokens'>): PresentationRoute[] {
  const routes: PresentationRoute[] = [
    { kind: 'revision', token: p.tokens.revision, path: `revision/${p.tokens.revision}/` },
  ]
  if (p.estado === 'lista') routes.push({ kind: 'envio', token: p.tokens.envio, path: `p/${p.tokens.envio}/` })
  return routes
}
