import type { ImageMetadata } from 'astro'
import { isTodo } from './todo'

// Imágenes del contenido (CONTENT_DIR/plazas/<slug>/media/*), importadas para que Astro
// las optimice (AVIF/WebP, varios anchos). El alias @content apunta a CONTENT_DIR.
// Import perezoso: solo se emiten al sitio las imágenes que alguna página usa.
const modules = import.meta.glob<{ default: ImageMetadata }>('@content/plazas/*/media/*.{jpg,jpeg,png,webp,avif}')

/** Índice "plazas/<slug>/media/<archivo>" → import de la imagen. */
const index = new Map(Object.entries(modules).map(([key, load]) => [key.slice(key.indexOf('plazas/')), load]))

/**
 * Imagen de una plaza a partir de la ruta escrita en plaza.yaml (relativa a la carpeta
 * de la plaza, p. ej. "media/fachada-marina.jpg"). undefined si está en TODO.
 */
export async function plazaImage(plazaSlug: string, ruta: string | undefined): Promise<ImageMetadata | undefined> {
  if (!ruta || isTodo(ruta)) return undefined
  const key = `plazas/${plazaSlug}/${ruta.replace(/^\.?\//, '')}`
  const load = index.get(key)
  if (!load) throw new Error(`no se encontró la imagen ${key} en CONTENT_DIR`)
  return (await load()).default
}
