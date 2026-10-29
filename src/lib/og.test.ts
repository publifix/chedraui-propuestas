import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { buildContent } from './content'
import { presentationMeta } from './meta'
import { externalOgImage, OG_HEIGHT, OG_WIDTH, ogHash, ogPath, renderOgImage } from './og'
import { resolvePresentation } from './resolve'
import { seedFiles } from './test-utils'

const CONTENT = path.resolve(import.meta.dirname, '../../content')
const model = resolvePresentation(buildContent(seedFiles()), '2026-11-rubi-perfumeria-a25-a26')

describe('imagen Open Graph', () => {
  it('el nombre es un hash estable que no revela el id, el prospecto ni los tokens', () => {
    const hash = ogHash(model)
    expect(hash).toMatch(/^[0-9a-f]{20}$/)
    expect(ogHash(model)).toBe(hash)
    expect(ogPath(model)).toBe(`og/${hash}.jpg`)
    for (const dato of [model.id, model.tokens.envio, model.tokens.revision, 'rubi']) expect(ogPath(model)).not.toContain(dato)
  })

  it('cambia si cambian los tokens', () => {
    expect(ogHash({ tokens: { envio: 'otroToken123456', revision: model.tokens.revision } })).not.toBe(ogHash(model))
  })

  it('se genera en 1200×630, en JPEG y con peso apto para WhatsApp', async () => {
    const image = await renderOgImage(model, CONTENT)
    const info = await sharp(image).metadata()
    expect([info.width, info.height, info.format]).toEqual([OG_WIDTH, OG_HEIGHT, 'jpeg'])
    expect(image.length).toBeLessThan(300_000)
  }, 20_000)

  it('si la presentación define imagen_og en la plaza, se recorta esa imagen', async () => {
    const custom = { ...model, seo: { ...model.seo, imagen_og: 'media/terraza-marina.jpg' } }
    const info = await sharp(await renderOgImage(custom, CONTENT)).metadata()
    expect([info.width, info.height]).toEqual([OG_WIDTH, OG_HEIGHT])
  })

  it('una imagen_og externa se usa tal cual', () => {
    const external = { ...model, seo: { ...model.seo, imagen_og: 'https://cdn.example.com/og.jpg' } }
    expect(externalOgImage(external)).toBe('https://cdn.example.com/og.jpg')
    expect(presentationMeta(external, { path: 'p/x/' }, 'https://publifix.github.io', '/chedraui-propuestas/').image).toMatchObject({
      url: 'https://cdn.example.com/og.jpg',
    })
  })
})

describe('metadatos de la página', () => {
  const meta = presentationMeta(model, { path: 'revision/qlJayOag7vK0Yncs/' }, 'https://publifix.github.io', '/chedraui-propuestas/')

  it('og:url y og:image son absolutas y respetan el base del sitio', () => {
    expect(meta.url).toBe('https://publifix.github.io/chedraui-propuestas/revision/qlJayOag7vK0Yncs/')
    expect(meta.image.url).toBe(`https://publifix.github.io/chedraui-propuestas/og/${ogHash(model)}.jpg`)
    expect(meta.image).toMatchObject({ width: 1200, height: 630, type: 'image/jpeg' })
  })

  it('título, descripción y robots salen de la presentación', () => {
    expect(meta).toMatchObject({ title: model.seo.titulo, description: model.seo.descripcion, robots: 'noindex, nofollow' })
    expect(meta.image.alt).toBe('Propuesta para Rubí Perfumería en El Dorado Centro Comercial & Marina')
  })

  it('funciona con otro base (dominio propio)', () => {
    expect(presentationMeta(model, { path: 'p/abc/' }, 'https://propuestas.example.com', '/').url).toBe('https://propuestas.example.com/p/abc/')
  })
})
