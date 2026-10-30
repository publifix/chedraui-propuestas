// Convierte la ruta de impresión de cada link (…/imprimir/) en el PDF de la propuesta, con
// Playwright y Chromium sin interfaz, y retira esas rutas del sitio (CLAUDE.md §10, PDF).
// Uso: node scripts/pdf.mjs [dist] (después de astro build; lo llama `pnpm build`).
// Falla con un mensaje claro si una propuesta no cabe en dos hojas carta o pesa 2 MB o más.
import { createServer } from 'node:http'
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { PDFDocument } from 'pdf-lib'

const dist = path.resolve(process.argv[2] ?? 'dist')
const BASE = '/chedraui-propuestas/'
const HOJAS = 2
const MAX_BYTES = 2 * 1024 * 1024
const PX_A_MM = 25.4 / 96

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml' }

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    statSync(full).isDirectory() ? walk(full, out) : out.push(full)
  }
  return out
}

/** Servidor estático de dist/ bajo el base del sitio, solo para esta conversión. */
function servir() {
  const server = createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (!url.startsWith(BASE)) return res.writeHead(404).end()
    let file = path.join(dist, url.slice(BASE.length))
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!file.startsWith(dist) || !existsSync(file)) return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': TIPOS[path.extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

const paginas = walk(dist).filter((f) => f.endsWith(`${path.sep}imprimir${path.sep}index.html`))
if (paginas.length === 0) {
  console.log('pdf: no hay rutas de impresión que convertir.')
  process.exit(0)
}

const server = await servir()
const origen = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch()
const errores = []
let generados = 0

try {
  const page = await browser.newPage({ viewport: { width: 816, height: 1056 } })
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' })
  for (const archivoHtml of paginas) {
    const rel = path.relative(dist, path.dirname(archivoHtml)).split(path.sep).join('/')
    await page.goto(`${origen}${BASE}${rel}/`, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    const meta = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[name^="pdf:"]')].map((m) => [m.name.slice(4), m.content])))
    const etiqueta = meta.archivo ?? rel

    // Cada hoja mide una carta exacta: si su contenido es más alto, la propuesta no cabe.
    const hojas = await page.evaluate(() => [...document.querySelectorAll('.hoja')].map((h) => ({ alto: h.clientHeight, contenido: h.scrollHeight, nombre: h.getAttribute('aria-label') })))
    if (hojas.length !== HOJAS) errores.push(`${etiqueta}: la ruta de impresión tiene ${hojas.length} hojas; el PDF debe tener exactamente ${HOJAS}`)
    hojas.forEach((h, i) => {
      if (h.contenido > h.alto + 1) {
        errores.push(`${etiqueta}: el contenido de la hoja ${i + 1} (${h.nombre}) no cabe en una carta: se excede ${((h.contenido - h.alto) * PX_A_MM).toFixed(1)} mm. Acorta textos o quita datos de la presentación.`)
      }
    })

    const bytes = await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true, tagged: true, outline: false })
    const doc = await PDFDocument.load(bytes, { updateMetadata: false })
    if (doc.getPageCount() !== HOJAS) errores.push(`${etiqueta}: el PDF salió con ${doc.getPageCount()} páginas; deben ser exactamente ${HOJAS}`)
    doc.setTitle(await page.title(), { showInWindowTitleBar: true })
    if (meta.autor) doc.setAuthor(meta.autor)
    if (meta.asunto) doc.setSubject(meta.asunto)
    doc.setCreator('Publifix · motor de propuestas comerciales')
    doc.setProducer('Chromium (Playwright) + pdf-lib')
    doc.setLanguage('es-MX')
    const final = await doc.save()
    if (final.byteLength >= MAX_BYTES) errores.push(`${etiqueta}: el PDF pesa ${(final.byteLength / 1024 / 1024).toFixed(2)} MB; debe pesar menos de 2 MB`)
    if (!meta.archivo) {
      errores.push(`${rel}: falta <meta name="pdf:archivo"> en la ruta de impresión`)
      continue
    }
    writeFileSync(path.join(dist, meta.archivo), final)
    generados++
  }
} finally {
  await browser.close()
  server.close()
}

// Las rutas de impresión solo existen para generar el PDF: no se publican. Para revisar su diseño
// en el navegador, PDF_CONSERVAR_IMPRESION=1 las deja en dist/ (nunca en CI).
if (!process.env.PDF_CONSERVAR_IMPRESION) {
  for (const archivoHtml of paginas) rmSync(path.dirname(archivoHtml), { recursive: true, force: true })
}

if (errores.length > 0) {
  console.error(`No se pudieron generar los PDF (${errores.length} problema(s)):\n${errores.map((e) => `  - ${e}`).join('\n')}`)
  process.exit(1)
}
console.log(`pdf: ${generados} PDF generados en ${path.relative(process.cwd(), dist) || '.'}`)
