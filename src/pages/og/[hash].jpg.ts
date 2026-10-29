// Imagen Open Graph de cada presentación, generada en el build (src/lib/og.ts).
import type { APIRoute } from 'astro'
import { resolveContentDir } from '../../lib/content'
import { externalOgImage, ogHash, renderOgImage } from '../../lib/og'
import { resolveAll, type ResolvedPresentation } from '../../lib/resolve'
import { getContent } from '../../lib/site'

export function getStaticPaths() {
  return resolveAll(getContent())
    .filter((model) => !externalOgImage(model))
    .map((model) => ({ params: { hash: ogHash(model) }, props: { model } }))
}

export const GET: APIRoute = async ({ props }) => {
  const jpeg = await renderOgImage((props as { model: ResolvedPresentation }).model, resolveContentDir())
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg' } })
}
