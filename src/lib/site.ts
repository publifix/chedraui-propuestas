import { loadContent, type Content } from './content'
import { resolveAll, type ResolvedPresentation } from './resolve'
import { presentationRoutes, type PresentationRoute } from './routes'

let cached: Content | undefined

/** Contenido validado del build (se carga una sola vez por proceso). */
export function getContent(): Content {
  cached ??= loadContent()
  return cached
}

export interface RouteEntry {
  params: { token: string }
  props: { model: ResolvedPresentation }
}

/** Entradas de getStaticPaths para un tipo de link. */
export function staticPaths(kind: PresentationRoute['kind']): RouteEntry[] {
  return resolveAll(getContent()).flatMap((model) =>
    presentationRoutes(model)
      .filter((route) => route.kind === kind)
      .map((route) => ({ params: { token: route.token }, props: { model } })),
  )
}
