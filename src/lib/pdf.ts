// PDF de la propuesta (dos hojas carta): nombre de archivo, folio, rutas y fecha de emisión.
// El PDF se genera en el build (scripts/pdf.mjs) a partir de la ruta de impresión de cada link.
import { createHash } from 'node:crypto'
import { joinBase } from './paths'
import type { PresentationRoute } from './routes'

interface ModeloPdf {
  id: string
  plaza: { nombre: string }
  locales: Array<{ clave: string }>
  prospecto: { marca: string }
}

/** "Rubí Perfumería" → "Rubi-Perfumeria"; "A25+A26" → "A25-A26". */
export function segmentoArchivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** "Propuesta-El-Dorado-A25-A26-Rubi-Perfumeria.pdf"; en revisión termina en "-vista-previa". */
export function nombreArchivoPdf(model: ModeloPdf, kind: PresentationRoute['kind']): string {
  const partes = ['Propuesta', model.plaza.nombre, ...model.locales.map((l) => l.clave), model.prospecto.marca].map(segmentoArchivo)
  return `${partes.join('-')}${kind === 'revision' ? '-vista-previa' : ''}.pdf`
}

const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Folio corto y estable: iniciales de la plaza y seis caracteres derivados del id de la
 * presentación ("El Dorado" → "ED-7K3Q9P"). Sin letras ambiguas (I, O, 0, 1).
 */
export function folio(model: Pick<ModeloPdf, 'id' | 'plaza'>): string {
  const iniciales = segmentoArchivo(model.plaza.nombre)
    .split('-')
    .map((p) => p[0]!.toUpperCase())
    .join('')
    .slice(0, 3)
  const hash = createHash('sha256').update(model.id).digest()
  const codigo = [...hash.subarray(0, 6)].map((b) => BASE32[b % BASE32.length]).join('')
  return `${iniciales}-${codigo}`
}

/** Ruta del PDF de un link (relativa al base): junto a su página, nunca la del otro link. */
export function rutaPdf(model: ModeloPdf, route: Pick<PresentationRoute, 'kind' | 'path'>): string {
  return `${route.path}${nombreArchivoPdf(model, route.kind)}`
}

/** Ruta de impresión de un link (relativa al base); el build la convierte a PDF y la retira. */
export function rutaImpresion(route: Pick<PresentationRoute, 'path'>): string {
  return `${route.path}imprimir/`
}

/** URL absoluta de un link, para el QR del PDF. */
export function urlAbsoluta(site: URL | string, base: string, path: string): string {
  return new URL(joinBase(base, path), site).toString()
}

/** Fecha de emisión: el día del build en la hora del centro de México, AAAA-MM-DD. */
export function fechaEmision(now = new Date(), timeZone = 'America/Mexico_City'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

interface ModeloMeta extends ModeloPdf {
  plaza: { nombre: string; nombre_completo?: string | undefined }
  locales: Array<{ clave: string }>
}

/**
 * Metadatos del PDF de un link: archivo (relativo al base), título, autor (la plaza), asunto y la
 * URL a la que apunta el QR (el mismo link: el PDF de envío lleva al de envío, el de revisión al de
 * revisión).
 */
export function pdfMeta(model: ModeloMeta, route: Pick<PresentationRoute, 'kind' | 'path'>, site: URL | string, base: string) {
  const plaza = model.plaza.nombre_completo ?? model.plaza.nombre
  const locales = model.locales.map((l) => l.clave).join(' y ')
  return {
    archivo: rutaPdf(model, route),
    titulo: `Propuesta comercial para ${model.prospecto.marca} · ${plaza}`,
    autor: plaza,
    asunto: `Propuesta comercial del local ${locales} en ${plaza} para ${model.prospecto.marca}`,
    urlInteractiva: urlAbsoluta(site, base, route.path),
  }
}
