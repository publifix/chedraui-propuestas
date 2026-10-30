// Contrato del plano de un nivel (CLAUDE.md §7.1.2) y utilidades para leerlo sin DOM, en el build.

/** Grupos de capas de nombre fijo. `marina` y `rutas` son opcionales. */
export const CAPAS = ['contorno', 'pasillos', 'locales', 'anclas', 'accesos', 'estacionamiento', 'marina', 'etiquetas', 'rutas'] as const
export const CAPAS_OBLIGATORIAS = ['contorno', 'pasillos', 'locales', 'anclas', 'accesos', 'estacionamiento', 'etiquetas'] as const
export type Capa = (typeof CAPAS)[number]

export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

export interface ViewBox extends BBox {}

export interface Element {
  tag: string
  attrs: Record<string, string>
}

export interface FloorPlanInfo {
  viewBox: ViewBox
  /** Locales por clave, con su caja para el zoom. */
  locales: Map<string, { id: string; bbox: BBox }>
  /** Ids de los posibles orígenes de una ruta: estacionamientos, anclas y accesos. */
  origenes: Map<string, string>
  anclas: Array<{ id: string; marca: string }>
  accesos: Array<{ id: string; nombre: string }>
  estacionamientos: Array<{ id: string; nombre: string }>
  rutas: Array<{ id: string; desde: string; hasta: string }>
}

/** "A25+A26" → "local-a25-a26". */
export function localId(clave: string): string {
  return `local-${clave.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

export function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of source.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[m[1]!] = m[2]!
  return attrs
}

/** Contenido interior de cada grupo de capa (<g id="…">), respetando grupos anidados. */
export function findLayers(svg: string): Map<string, string> {
  const layers = new Map<string, string>()
  const open = /<g\b([^>]*)>/g
  for (let m = open.exec(svg); m; m = open.exec(svg)) {
    const id = parseAttributes(m[1]!)['id']
    if (!id || !(CAPAS as readonly string[]).includes(id)) continue
    let depth = 1
    const tag = /<(\/?)g\b[^>]*?(\/?)>/g
    tag.lastIndex = open.lastIndex
    let end = svg.length
    for (let t = tag.exec(svg); t; t = tag.exec(svg)) {
      if (t[2]) continue
      depth += t[1] ? -1 : 1
      if (depth === 0) {
        end = t.index
        break
      }
    }
    layers.set(id, svg.slice(open.lastIndex, end))
  }
  return layers
}

const SHAPES = /<(rect|polygon|polyline|path|circle|ellipse|line|text)\b([^>]*?)\/?>/g

export function elementsIn(source: string): Element[] {
  return [...source.matchAll(SHAPES)].map((m) => ({ tag: m[1]!, attrs: parseAttributes(m[2]!) }))
}

export function parseViewBox(svg: string): ViewBox | undefined {
  const root = /<svg\b([^>]*)>/.exec(svg)
  const vb = root && parseAttributes(root[1]!)['viewBox']
  const nums = vb?.trim().split(/[\s,]+/).map(Number)
  if (!nums || nums.length !== 4 || nums.some((n) => !Number.isFinite(n))) return undefined
  const [x, y, width, height] = nums as [number, number, number, number]
  return { x, y, width, height }
}

/** Caja de un rect o polygon (los locales del contrato solo usan esas dos formas, sin transform). */
export function bbox(el: Element): BBox | undefined {
  if (el.tag === 'rect') {
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => Number(el.attrs[k] ?? 0)) as [number, number, number, number]
    return w > 0 && h > 0 ? { x, y, width: w, height: h } : undefined
  }
  if (el.tag === 'polygon') {
    const nums = (el.attrs['points'] ?? '').trim().split(/[\s,]+/).map(Number)
    if (nums.length < 6 || nums.length % 2 || nums.some((n) => !Number.isFinite(n))) return undefined
    const xs = nums.filter((_, i) => i % 2 === 0)
    const ys = nums.filter((_, i) => i % 2 === 1)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
  }
  return undefined
}

/** Contenido que nunca debe llegar al navegador desde un SVG de contenido. */
const UNSAFE = [
  [/<script\b/i, 'no puede contener <script>'],
  [/\son[a-z]+\s*=/i, 'no puede contener manejadores de eventos (on…=)'],
  [/javascript:/i, 'no puede contener ligas javascript:'],
  [/<foreignObject\b/i, 'no puede contener <foreignObject>'],
  [/(?:xlink:)?href\s*=\s*"(?!#)/i, 'no puede enlazar recursos externos (href fuera del propio SVG)'],
] as const

export function unsafeContent(svg: string): string[] {
  return UNSAFE.filter(([re]) => re.test(svg)).map(([, msg]) => msg)
}

/** Valida el contrato de un plano de nivel. Devuelve los errores (en español) y la información leída. */
export function readFloorPlan(svg: string): { errors: string[]; info?: FloorPlanInfo } {
  const errors = [...unsafeContent(svg)]
  const viewBox = parseViewBox(svg)
  if (!viewBox) errors.push('el <svg> necesita un viewBox válido')
  const layers = findLayers(svg)
  const faltan = CAPAS_OBLIGATORIAS.filter((c) => !layers.has(c))
  if (faltan.length > 0) errors.push(`faltan grupos de capa: ${faltan.map((c) => `<g id="${c}">`).join(', ')}`)

  const locales = new Map<string, { id: string; bbox: BBox }>()
  for (const el of elementsIn(layers.get('locales') ?? '')) {
    const { id, 'data-clave': clave } = el.attrs
    if (!clave) {
      errors.push(`en "locales" todo elemento necesita data-clave (${el.tag}${id ? ` id="${id}"` : ''})`)
      continue
    }
    if (id !== localId(clave)) errors.push(`el local "${clave}" debe tener id="${localId(clave)}"`)
    const box = bbox(el)
    if (!box) errors.push(`el local "${clave}" debe ser un <rect> o <polygon> válido`)
    if (locales.has(clave)) errors.push(`el local "${clave}" está repetido`)
    if (box) locales.set(clave, { id: localId(clave), bbox: box })
  }

  const conPrefijo = (capa: Capa, prefijo: string, atributo: string) =>
    elementsIn(layers.get(capa) ?? '')
      .filter((el) => el.tag !== 'text')
      .flatMap((el) => {
        const { id } = el.attrs
        const valor = el.attrs[atributo]
        if (!id?.startsWith(prefijo) || !valor) {
          errors.push(`en "${capa}" cada elemento necesita id="${prefijo}…" y ${atributo}`)
          return []
        }
        return [{ id, valor }]
      })
  const anclas = conPrefijo('anclas', 'ancla-', 'data-marca').map(({ id, valor }) => ({ id, marca: valor }))
  const accesos = conPrefijo('accesos', 'acceso-', 'data-nombre').map(({ id, valor }) => ({ id, nombre: valor }))
  const estacionamientos = conPrefijo('estacionamiento', 'estacionamiento-', 'data-nombre').map(({ id, valor }) => ({ id, nombre: valor }))
  const origenes = new Map([...estacionamientos, ...accesos].map((e) => [e.id, e.nombre]))
  for (const a of anclas) origenes.set(a.id, a.marca)

  const rutas = elementsIn(layers.get('rutas') ?? '').flatMap((el) => {
    const { id, 'data-desde': desde, 'data-hasta': hasta } = el.attrs
    if (el.tag !== 'path' || !id || !desde || !hasta) {
      errors.push('en "rutas" cada elemento debe ser un <path> con id, data-desde y data-hasta')
      return []
    }
    if (!origenes.has(desde)) errors.push(`la ruta "${id}" sale de "${desde}", que no es un estacionamiento, ancla ni acceso del plano`)
    if (!locales.has(hasta)) errors.push(`la ruta "${id}" llega a "${hasta}", que no es un local del plano`)
    return [{ id, desde, hasta }]
  })

  if (!elementsIn(layers.get('etiquetas') ?? '').some((el) => 'data-leyenda' in el.attrs)) {
    errors.push('"etiquetas" debe incluir la leyenda (elemento con data-leyenda), p. ej. "Plano esquemático, no a escala"')
  }

  if (errors.length > 0 || !viewBox) return { errors }
  return { errors, info: { viewBox, locales, origenes, anclas, accesos, estacionamientos, rutas } }
}

export interface PrepareOptions {
  /** Prefijo para los ids: el mismo plano puede aparecer varias veces en la página. */
  prefix: string
  /** Atributos extra por clave de local (aria, data-*, clases). */
  locales?: Record<string, Record<string, string>>
  /** Atributos extra para las etiquetas, por su data-para. */
  labels?: Record<string, Record<string, string>>
  /** viewBox a usar en lugar del original (recorte). */
  viewBox?: ViewBox
}

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Prepara el SVG para insertarlo en la página: ids con prefijo, data-capa en las capas, atributos de locales. */
export function prepareSvg(svg: string, { prefix, locales = {}, labels = {}, viewBox }: PrepareOptions): string {
  let out = svg
    .replace(/<\?xml[^>]*>/, '')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<desc>[\s\S]*?<\/desc>/, '')
  out = out.replace(/<g\b([^>]*)>/g, (tag, attrs: string) => {
    const id = parseAttributes(attrs)['id']
    return id ? tag.replace(/\bid="([^"]*)"/, `id="${prefix}$1" data-capa="$1"`) : tag
  })
  out = out.replace(/<(rect|polygon|polyline|path|circle|ellipse|line|text)\b([^>]*?)(\/?)>/g, (_tag, name: string, attrs: string, selfClose: string) => {
    const parsed = parseAttributes(attrs)
    let a = attrs.replace(/\bid="([^"]*)"/, `id="${prefix}$1" data-ref="$1"`)
    const extra = parsed['data-clave'] ? locales[parsed['data-clave']] : parsed['data-para'] ? labels[parsed['data-para']] : undefined
    if (extra) a += Object.entries(extra).map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('')
    return `<${name}${a}${selfClose}>`
  })
  out = out.replace(/<svg\b([^>]*)>/, (_tag, attrs: string) => {
    let a = attrs.replace(/\s(width|height)="[^"]*"/g, '')
    if (viewBox) a = a.replace(/viewBox="[^"]*"/, `viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"`)
    return `<svg${a} class="plano-svg" focusable="false">`
  })
  return out.trim()
}

export interface Etiqueta {
  /** data-para: clave del local o id del elemento que rotula. */
  para: string
  x: number
  y: number
  texto: string
}

/** Rótulos del plano (<text data-para>) con su posición, p. ej. para rotularlos fuera del SVG. */
export function etiquetas(svg: string): Etiqueta[] {
  return [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].flatMap(([, attrs, texto]) => {
    const a = parseAttributes(attrs!)
    return a['data-para'] ? [{ para: a['data-para'], x: Number(a['x']), y: Number(a['y']), texto: texto!.trim() }] : []
  })
}

/** Caja ampliada alrededor de una caja, dentro del viewBox y con la proporción indicada. */
export function frameAround(box: BBox, view: ViewBox, { width, ratio }: { width: number; ratio: number }): ViewBox {
  const w = Math.min(view.width, Math.max(width, box.width * 1.6))
  const h = Math.min(view.height, w / ratio)
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const x = Math.min(Math.max(cx - w / 2, view.x), view.x + view.width - w)
  const y = Math.min(Math.max(cy - h / 2, view.y), view.y + view.height - h)
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) }
}
