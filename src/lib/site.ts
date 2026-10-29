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
  props: { model: ResolvedPresentation; route: PresentationRoute }
}

/**
 * Entradas de getStaticPaths para un tipo de link: revisión para toda presentación, envío solo
 * para las que están en "lista". Un token que no está aquí no tiene página: GitHub Pages sirve 404.
 */
export function staticPaths(kind: PresentationRoute['kind'], content: Content = getContent()): RouteEntry[] {
  return resolveAll(content).flatMap((model) =>
    presentationRoutes(model)
      .filter((route) => route.kind === kind)
      .map((route) => ({ params: { token: route.token }, props: { model, route } })),
  )
}
