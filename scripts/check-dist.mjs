// Verifica el sitio construido (dist/) antes de publicarlo: 404, robots, sin sitemap, sin
// listados de presentaciones, rutas de envío solo para presentaciones "lista" y metadatos de
// cada página (CLAUDE.md §10). Uso: node scripts/check-dist.mjs [dist] (después de pnpm build).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const dist = path.resolve(process.argv[2] ?? 'dist')
const contentDir = path.resolve(process.env.CONTENT_DIR || 'content')
const SITE = 'https://publifix.github.io'
const BASE = '/chedraui-propuestas/'
const errors = []
const check = (ok, message) => ok || errors.push(message)
const read = (rel) => readFileSync(path.join(dist, rel), 'utf8')
const meta = (html, attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    statSync(full).isDirectory() ? walk(full, out) : out.push(path.relative(dist, full).split(path.sep).join('/'))
  }
  return out
}

/** Ancho y alto de un JPEG (marcador SOF) o PNG (IHDR). */
function imageSize(file) {
  const b = readFileSync(file)
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  for (let i = 2; i < b.length; ) {
    const marker = b[i + 1]
    const length = b.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) }
    i += 2 + length
  }
  return undefined
}

const files = walk(dist)

// 404 sobrio, sin datos de presentaciones.
check(existsSync(path.join(dist, '404.html')), 'falta dist/404.html')
if (existsSync(path.join(dist, '404.html'))) {
  const html = read('404.html')
  check(/noindex, nofollow/.test(html), '404.html debe ser noindex, nofollow')
  check(/Publifix/.test(html), '404.html debe mostrar la identidad de Publifix')
  check(!/\/(p|revision)\//.test(html), '404.html no debe enlazar presentaciones')
}

// robots.txt y sin sitemap.
check(existsSync(path.join(dist, 'robots.txt')), 'falta robots.txt')
if (existsSync(path.join(dist, 'robots.txt'))) {
  const robots = read('robots.txt')
  check(robots.includes(`Disallow: ${BASE}p/`) && robots.includes(`Disallow: ${BASE}revision/`), 'robots.txt debe bloquear /p/ y /revision/')
}
check(!files.some((f) => /sitemap/i.test(f)), 'no debe generarse sitemap')

// Material de referencia (_referencias/, p. ej. la copia del sitio de Chedraui) nunca se publica.
for (const f of files) {
  check(!/_referencias|ChedrauiInmobiliaria|_4omz\./i.test(f), `${f}: el material de referencia no debe publicarse`)
}
for (const f of files.filter((f) => /\.(html|css|js)$/.test(f))) {
  check(!/_referencias\/|ChedrauiInmobiliaria/.test(read(f)), `${f}: no debe enlazar material de referencia`)
}

// Ninguna página lista presentaciones: solo las páginas de una presentación enlazan a /p/ o /revision/.
for (const f of files.filter((f) => f.endsWith('.html') && !/^(p|revision)\//.test(f))) {
  check(!/href="[^"]*\/(p|revision)\//.test(read(f)), `${f} no debe enlazar presentaciones`)
}

// Rutas: revisión siempre, envío solo para presentaciones en estado "lista".
const presentaciones = readdirSync(path.join(contentDir, 'presentaciones'))
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => parse(readFileSync(path.join(contentDir, 'presentaciones', f), 'utf8')))
for (const p of presentaciones) {
  check(files.includes(`revision/${p.tokens.revision}/index.html`), `${p.id}: falta la ruta de revisión`)
  const envio = files.includes(`p/${p.tokens.envio}/index.html`)
  check(envio === (p.estado === 'lista'), `${p.id}: la ruta de envío ${p.estado === 'lista' ? 'falta' : 'no debe existir en borrador'}`)
}
const tokens = new Set(presentaciones.flatMap((p) => [p.tokens.envio, p.tokens.revision]))
for (const f of files.filter((f) => /^(p|revision)\/[^/]+\/index\.html$/.test(f))) {
  check(tokens.has(f.split('/')[1]), `${f} no corresponde a ningún token`)
}

// Metadatos de cada página de presentación.
for (const f of files.filter((f) => /^(p|revision)\/[^/]+\/index\.html$/.test(f))) {
  const html = read(f)
  const url = `${SITE}${BASE}${f.replace(/index\.html$/, '')}`
  check(meta(html, 'name', 'robots') === 'noindex, nofollow', `${f}: falta noindex, nofollow`)
  check(meta(html, 'property', 'og:url') === url, `${f}: og:url debe ser ${url}`)
  check(!!meta(html, 'property', 'og:title') && !!meta(html, 'name', 'description'), `${f}: faltan título o descripción`)
  check(meta(html, 'name', 'twitter:card') === 'summary_large_image', `${f}: twitter:card debe ser summary_large_image`)
  check(/<link rel="icon" href="[^"]+"/.test(html), `${f}: falta favicon`)
  const image = meta(html, 'property', 'og:image')
  check(image?.startsWith(`${SITE}${BASE}`) || image?.startsWith('https://'), `${f}: og:image debe ser absoluta`)
  if (image?.startsWith(`${SITE}${BASE}`)) {
    const file = path.join(dist, image.slice(`${SITE}${BASE}`.length))
    const size = existsSync(file) ? imageSize(file) : undefined
    check(size?.width === 1200 && size?.height === 630, `${f}: la imagen OG debe existir y medir 1200×630`)
    check(existsSync(file) && statSync(file).size < 300_000, `${f}: la imagen OG debe pesar menos de 300 KB`)
  }
}

// Vigencia: el aviso de propuesta vencida solo existe dentro de <template> (SiVencida). El HTML
// visible de una página nunca dice que la propuesta venció; lo decide el navegador con su fecha.
for (const f of files.filter((f) => /^(p|revision)\/[^/]+\/index\.html$/.test(f))) {
  const visible = read(f).replace(/<template[\s\S]*?<\/template>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
  check(!/venci[óo]/i.test(visible), `${f}: el aviso de propuesta vencida debe ir dentro de <template>`)
}

// Link de envío: nada que delate un dato pendiente o de demostración (CLAUDE.md §7.5.2 y §7.6).
for (const f of files.filter((f) => /^p\/[^/]+\/index\.html$/.test(f))) {
  const html = read(f)
  const markup = html.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/g, '')
  const texto = markup.replace(/<[^>]+>/g, ' ')
  for (const [re, what] of [
    [/\bTODO\b/, 'un TODO'],
    [/\bDEMO\b|demostraci[óo]n/i, 'una marca de demostración'],
    [/pendiente/i, 'la palabra "pendiente"'],
  ]) {
    check(!re.test(texto), `${f}: el link de envío no debe mostrar ${what}`)
  }
  check(!/class="[^"]*\b(todo|media-placeholder|review-banner)\b/.test(markup), `${f}: el link de envío no debe tener marcadores de revisión`)
}

// PDF de la propuesta (dos hojas carta): uno por link, junto a su página, nunca cruzado.
const rutasImpresion = files.filter((f) => /\/imprimir\//.test(f))
check(rutasImpresion.length === 0, `las rutas de impresión no deben publicarse: ${rutasImpresion.slice(0, 3).join(', ')}`)

/** Texto y enlaces de un PDF, con pdfjs. */
async function leerPdf(file) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: false, isEvalSupported: false }).promise
  let texto = ''
  const enlaces = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    texto += (await page.getTextContent()).items.map((it) => it.str).join(' ') + '\n'
    for (const a of await page.getAnnotations()) if (a.url) enlaces.push(a.url)
  }
  const { info } = await doc.getMetadata()
  const marca = await doc.getMarkInfo()
  const etiquetado = (marca instanceof Map ? marca.get('Marked') : marca?.Marked) === true && Boolean(await (await doc.getPage(1)).getStructTree())
  return { paginas: doc.numPages, texto: texto.replace(/\s+/g, ' '), enlaces, info, etiquetado }
}

for (const p of presentaciones) {
  for (const [kind, token, carpeta] of [['envio', p.tokens.envio, 'p'], ['revision', p.tokens.revision, 'revision']]) {
    if (kind === 'envio' && p.estado !== 'lista') continue
    const dir = `${carpeta}/${token}/`
    const pdfs = files.filter((f) => f.startsWith(dir) && f.endsWith('.pdf'))
    check(pdfs.length === 1, `${p.id}: el link de ${kind} debe tener exactamente un PDF (tiene ${pdfs.length})`)
    if (pdfs.length !== 1) continue
    const pdf = pdfs[0]
    const nombre = pdf.slice(dir.length)
    check(/^Propuesta-[A-Za-z0-9-]+\.pdf$/.test(nombre), `${pdf}: nombre de archivo poco legible`)
    check(kind === 'revision' ? nombre.endsWith('-vista-previa.pdf') : !nombre.includes('vista-previa'), `${pdf}: el nombre no corresponde al link de ${kind}`)
    check(statSync(path.join(dist, pdf)).size < 2 * 1024 * 1024, `${pdf}: debe pesar menos de 2 MB`)
    const leido = await leerPdf(path.join(dist, pdf))
    const urlLink = `${SITE}${BASE}${dir}`
    check(leido.paginas === 2, `${pdf}: debe tener exactamente 2 páginas (tiene ${leido.paginas})`)
    check(leido.texto.includes(p.prospecto.marca), `${pdf}: debe incluir el nombre del prospecto (${p.prospecto.marca})`)
    // La URL puede partirse en dos líneas: se compara sin espacios.
    check(leido.texto.replace(/\s/g, '').includes(urlLink.replace(/^https:\/\//, '').replace(/\/$/, '')), `${pdf}: debe mostrar la URL del link interactivo`)
    check(leido.enlaces.includes(urlLink), `${pdf}: el QR debe enlazar a ${urlLink}`)
    check(leido.etiquetado, `${pdf}: debe ser un PDF etiquetado (accesible)`)
    check(Boolean(leido.info?.Title && leido.info?.Author && leido.info?.Subject), `${pdf}: faltan título, autor o asunto en los metadatos`)
    const interna = /vista previa interna/i.test(leido.texto)
    check(kind === 'revision' ? interna : !interna, `${pdf}: ${kind === 'revision' ? 'debe llevar' : 'no debe llevar'} la marca "Vista previa interna"`)
    check(!/\bTODO\b|\bDEMO\b|demostraci[óo]n/i.test(leido.texto), `${pdf}: no debe indicar datos pendientes ni de demostración`)
    // El total mensual debe ser el del módulo de cálculos (lo prueba también Vitest con la semilla).
    const total = leido.texto.match(/Total mensual \$([\d,]+(?:\.\d{2})?)/)?.[1]
    const html = read(`${dir}index.html`)
    const totalWeb = html.match(/Total mensual<\/dt>\s*<dd[^>]*><span class="t-figure"[^>]*>\$([\d,.]+)/)?.[1]
    check(total !== undefined && total === totalWeb, `${pdf}: el total mensual del PDF ($${total}) debe coincidir con el de la presentación ($${totalWeb})`)
    // Cada página enlaza solo su propio PDF.
    check(html.includes(`href="${BASE}${dir}${nombre}"`), `${dir}index.html: el botón de descarga debe enlazar ${nombre}`)
    const ajeno = kind === 'envio' ? /href="[^"]*\/revision\/[^"]*\.pdf"/ : /href="[^"]*\/p\/[^"]*\.pdf"/
    check(!ajeno.test(html), `${dir}index.html: no debe enlazar el PDF del otro link`)
  }
}

if (errors.length > 0) {
  console.error(`dist/ tiene ${errors.length} problema(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  process.exit(1)
}
console.log(`dist/ verificado: ${files.length} archivos, ${presentaciones.length} presentación(es).`)
