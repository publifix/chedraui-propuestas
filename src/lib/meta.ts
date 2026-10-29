import { externalOgImage, OG_HEIGHT, OG_WIDTH, ogPath } from './og'
import { joinBase } from './paths'
import type { ResolvedPresentation } from './resolve'
import type { PresentationRoute } from './routes'

export interface PageMeta {
  title: string
  description: string
  /** URL absoluta de la página, respetando el base del sitio. */
  url: string
  /** type solo se conoce cuando la imagen la genera el build. */
  image: { url: string; width: number; height: number; alt: string; type?: 'image/jpeg' }
  robots: 'noindex, nofollow'
}

/** Metadatos de una página de presentación (CLAUDE.md §10): siempre noindex, OG y tarjeta grande. */
export function presentationMeta(
  model: Pick<ResolvedPresentation, 'seo' | 'tokens' | 'prospecto' | 'plaza'>,
  route: Pick<PresentationRoute, 'path'>,
  site: string | URL,
  base: string,
): PageMeta {
  const absolute = (p: string) => new URL(joinBase(base, p), site).href
  const external = externalOgImage(model)
  return {
    title: model.seo.titulo,
    description: model.seo.descripcion,
    url: absolute(route.path),
    image: {
      url: external ?? absolute(ogPath(model)),
      ...(!external && { type: 'image/jpeg' as const }),
      width: OG_WIDTH,
      height: OG_HEIGHT,
      alt: `Propuesta para ${model.prospecto.marca} en ${model.plaza.nombre_completo ?? model.plaza.nombre}`,
    },
    robots: 'noindex, nofollow',
  }
}
