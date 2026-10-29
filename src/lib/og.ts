import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import satori from 'satori'
import sharp from 'sharp'
import type { ResolvedPresentation } from './resolve'
import { isTodo } from './todo'
import { isShortText } from './typography'

// Imagen Open Graph de cada presentación (vista previa de WhatsApp, CLAUDE.md §10).

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630
/** JPEG: con foto de fondo pesa una fracción de un PNG; WhatsApp omite vistas previas pesadas. */
const OG_JPEG = { quality: 84, mozjpeg: true, progressive: false }

type OgModel = Pick<ResolvedPresentation, 'tokens' | 'seo'>

/** Nombre del archivo: hash de los tokens, que no revela el id, el prospecto ni los tokens. */
export function ogHash(model: Pick<ResolvedPresentation, 'tokens'>): string {
  return createHash('sha256').update(`og:${model.tokens.envio}:${model.tokens.revision}`).digest('hex').slice(0, 20)
}

/** URL absoluta de seo.imagen_og, si la presentación define una externa. */
export function externalOgImage(model: OgModel): string | undefined {
  const og = model.seo.imagen_og
  return og && !isTodo(og) && /^https:\/\//.test(og) ? og : undefined
}

/** Ruta relativa al base del sitio de la imagen OG generada (o recortada de seo.imagen_og). */
export function ogPath(model: OgModel): string {
  return `og/${ogHash(model)}.jpg`
}

const requireFromRoot = createRequire(path.join(process.cwd(), 'package.json'))
const font = (weight: 500 | 700) =>
  readFileSync(requireFromRoot.resolve(`@fontsource/archivo/files/archivo-latin-${weight}-normal.woff`))

const dataUri = (buffer: Buffer, mime: string) => `data:${mime};base64,${buffer.toString('base64')}`

/** El logo de la plaza en el color del texto de marca, conservando su transparencia. */
async function tintedLogo(file: string, hex: string): Promise<{ uri: string; width: number; height: number }> {
  const logo = sharp(file).ensureAlpha().resize({ height: 150, withoutEnlargement: true })
  const { data: alpha, info } = await logo.clone().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true })
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
  const png = await sharp({ create: { width: info.width, height: info.height, channels: 3, background: { r, g, b } } })
    .joinChannel(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png()
    .toBuffer()
  return { uri: dataUri(png, 'image/png'), width: info.width, height: info.height }
}

interface Node {
  type: string
  props: Record<string, unknown> & { children?: Node | Node[] | string }
}
const h = (type: string, style: Record<string, unknown>, children?: Node | Node[] | string, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, ...extra, ...(children !== undefined && { children }) },
})

/**
 * JPEG de 1200×630: foto hero con capa en el color de marca (o solo el color de marca), logo de
 * la plaza, "Propuesta para {marca}", clave del local y nombre de la plaza, en Archivo.
 * Si la presentación define seo.imagen_og en la carpeta de la plaza, se recorta esa imagen.
 */
export async function renderOgImage(model: ResolvedPresentation, contentDir: string): Promise<Buffer> {
  const { plaza } = model
  const dir = path.join(contentDir, 'plazas', plaza.slug)
  const custom = model.seo.imagen_og
  if (custom && !isTodo(custom) && !externalOgImage(model)) {
    return sharp(path.join(dir, custom)).resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover' }).jpeg(OG_JPEG).toBuffer()
  }

  const { marca, texto_marca } = plaza.tema.colores
  const hero = isTodo(plaza.hero.imagen)
    ? undefined
    : dataUri(await sharp(path.join(dir, plaza.hero.imagen)).resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer(), 'image/jpeg')
  const logo = isTodo(plaza.tema.logo) ? undefined : await tintedLogo(path.join(dir, plaza.tema.logo), texto_marca)
  const claves = model.locales.map((l) => l.clave).join(' y ')
  const marcaProspecto = model.prospecto.marca
  const upper = isShortText(`Propuesta para ${marcaProspecto}`)

  const tree = h('div', { width: OG_WIDTH, height: OG_HEIGHT, display: 'flex', position: 'relative', background: marca, fontFamily: 'Archivo', color: texto_marca }, [
    ...(hero ? [h('img', { position: 'absolute', top: 0, left: 0, width: OG_WIDTH, height: OG_HEIGHT, objectFit: 'cover' }, undefined, { src: hero, width: OG_WIDTH, height: OG_HEIGHT })] : []),
    h('div', { position: 'absolute', top: 0, left: 0, width: OG_WIDTH, height: OG_HEIGHT, background: marca, opacity: hero ? 0.82 : 1 }),
    // satori suma el padding al tamaño: se usan márgenes y medidas explícitas.
    h('div', { position: 'absolute', top: 56, left: 72, width: OG_WIDTH - 144, height: OG_HEIGHT - 112, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }, [
      logo
        ? h('img', { height: 120, width: (logo.width * 120) / logo.height }, undefined, { src: logo.uri, width: (logo.width * 120) / logo.height, height: 120 })
        : h('div', { fontSize: 40, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase' }, plaza.nombre),
      h('div', { display: 'flex', flexDirection: 'column', gap: 12 }, [
        h('div', { fontSize: 30, fontWeight: 500, letterSpacing: upper ? 5 : 0, textTransform: upper ? 'uppercase' : 'none' }, 'Propuesta para'),
        h('div', { fontSize: marcaProspecto.length > 22 ? 64 : 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: upper ? 2 : -1, textTransform: upper ? 'uppercase' : 'none' }, marcaProspecto),
        h('div', { display: 'flex', fontSize: 28, fontWeight: 500, marginTop: 12, paddingTop: 20, borderTop: `2px solid ${texto_marca}` }, `Local ${claves} · ${plaza.nombre_completo ?? plaza.nombre}`),
      ]),
    ]),
  ])

  const svg = await satori(tree as never, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      { name: 'Archivo', data: font(500), weight: 500, style: 'normal' },
      { name: 'Archivo', data: font(700), weight: 700, style: 'normal' },
    ],
  })
  return sharp(Buffer.from(svg)).flatten({ background: marca }).jpeg(OG_JPEG).toBuffer()
}
