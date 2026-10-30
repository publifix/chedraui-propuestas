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

export interface Punto {
  x: number
  y: number
}

export interface FloorPlanInfo {
  viewBox: ViewBox
  /** Locales por clave, con su caja para el zoom y el punto donde se rotula. */
  locales: Map<string, { id: string; bbox: BBox; punto: Punto }>
  /** Ids de los posibles orígenes de una ruta: estacionamientos, anclas y accesos. */
  origenes: Map<string, string>
  anclas: Array<{ id: string; marca: string; punto?: Punto; bbox?: BBox }>
  accesos: Array<{ id: string; nombre: string }>
  estacionamientos: Array<{ id: string; nombre: string; punto?: Punto }>
  /** Áreas con nombre de la capa "marina" (opcional), para rotularlas. */
  marina: Array<{ nombre: string; punto: Punto }>
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

/** Vértices de un rect o polygon. */
export function vertices(el: Element): Punto[] | undefined {
  if (el.tag === 'rect') {
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => Number(el.attrs[k] ?? 0)) as [number, number, number, number]
    return w > 0 && h > 0 ? [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] : undefined
  }
  if (el.tag === 'polygon') {
    const nums = (el.attrs['points'] ?? '').trim().split(/[\s,]+/).map(Number)
    if (nums.length < 6 || nums.length % 2 || nums.some((n) => !Number.isFinite(n))) return undefined
    return nums.flatMap((n, i) => (i % 2 === 0 ? [{ x: n, y: nums[i + 1]! }] : []))
  }
  return undefined
}

function dentro(p: Punto, pts: Punto[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!
    const b = pts[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function distanciaAlBorde(p: Punto, pts: Punto[]): number {
  let min = Infinity
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j]!
    const b = pts[i]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
    min = Math.min(min, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)))
  }
  return min
}

/**
 * Punto para rotular un polígono: el centro de su caja si cae dentro y holgado; si no (formas en
 * L, triángulos), el punto interior más alejado de los bordes en una rejilla de 24 × 24.
 */
export function puntoRotulo(pts: Punto[]): Punto {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  let mejor = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
  let holgura = dentro(mejor, pts) ? distanciaAlBorde(mejor, pts) : -1
  const minimo = Math.min(x1 - x0, y1 - y0) * 0.3
  if (holgura >= minimo) return mejor
  const n = 24
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < n; j++) {
      const p = { x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * j) / n }
      if (!dentro(p, pts)) continue
      const d = distanciaAlBorde(p, pts)
      if (d > holgura) {
        holgura = d
        mejor = p
      }
    }
  }
  return { x: Math.round(mejor.x * 10) / 10, y: Math.round(mejor.y * 10) / 10 }
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

  const locales = new Map<string, { id: string; bbox: BBox; punto: Punto }>()
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
    if (box) locales.set(clave, { id: localId(clave), bbox: box, punto: puntoRotulo(vertices(el)!) })
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
        const pts = vertices(el)
        const box = bbox(el)
        return [{ id, valor, ...(pts && { punto: puntoRotulo(pts) }), ...(box && { bbox: box }) }]
      })
  const anclas = conPrefijo('anclas', 'ancla-', 'data-marca').map(({ id, valor, punto, bbox: box }) => ({ id, marca: valor, ...(punto && { punto }), ...(box && { bbox: box }) }))
  const accesos = conPrefijo('accesos', 'acceso-', 'data-nombre').map(({ id, valor }) => ({ id, nombre: valor }))
  const estacionamientos = conPrefijo('estacionamiento', 'estacionamiento-', 'data-nombre').map(({ id, valor, punto }) => ({ id, nombre: valor, ...(punto && { punto }) }))
  const marina = elementsIn(layers.get('marina') ?? '').flatMap((el) => {
    const pts = vertices(el)
    return el.attrs['data-nombre'] && pts ? [{ nombre: el.attrs['data-nombre'], punto: puntoRotulo(pts) }] : []
  })
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
  return { errors, info: { viewBox, locales, origenes, anclas, accesos, estacionamientos, marina, rutas } }
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
