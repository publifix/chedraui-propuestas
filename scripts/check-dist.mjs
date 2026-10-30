// Verifica el sitio construido (dist/) antes de publicarlo: 404, robots, sin sitemap, sin
// listados de presentaciones, rutas de envío solo para presentaciones "lista" y metadatos de
// cada página (CLAUDE.md §10). Uso: node scripts/check-dist.mjs [dist] (después de pnpm build).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'

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

if (errors.length > 0) {
  console.error(`dist/ tiene ${errors.length} problema(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  process.exit(1)
}
console.log(`dist/ verificado: ${files.length} archivos, ${presentaciones.length} presentación(es).`)
