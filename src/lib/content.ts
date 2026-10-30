import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { resolvePresentation } from './resolve'
import { checkContrast } from './theme/contrast'
import { localId, readFloorPlan, type FloorPlanInfo } from './plano/svg'
import { fontNames, isFont } from './theme/font-roles'
import type * as z from 'zod'
import {
  isTodo,
  asesorSchema,
  formatIssue,
  formatIssues,
  giroSchema,
  localSchema,
  plazaSchema,
  presentacionSchema,
  type Asesor,
  type Giro,
  type Local,
  type Plaza,
  type Presentacion,
} from '../schemas'

export interface LocalEntry {
  file: string
  local: Local
}

export interface PlazaEntry {
  file: string
  plaza: Plaza
  /** Locales de la plaza, indexados por `clave`. */
  locales: Map<string, LocalEntry>
  /** Planos que cumplen el contrato (CLAUDE.md §7.1.2), por id de nivel. */
  planos: Map<string, { file: string; svg: string; info: FloorPlanInfo }>
}

export interface Todo {
  file: string
  line: number
  text: string
}

/** Valor de demostración: línea del YAML marcada con un comentario `# DEMO` (CLAUDE.md §7.6). */
export interface DemoMark {
  file: string
  line: number
  text: string
}

export interface Content {
  plazas: Map<string, PlazaEntry>
  giros: Map<string, Giro>
  /** Indexados por slug (nombre del archivo). */
  asesores: Map<string, Asesor>
  presentaciones: Map<string, Presentacion>
  todos: Todo[]
  /** Marcas `# DEMO` de cada archivo YAML, por ruta (con el prefijo de la carpeta de contenido). */
  demos: Map<string, DemoMark[]>
  /** Archivo de cada giro, asesor y presentación ("giros/<slug>" → ruta), para ubicar sus marcas. */
  archivos: Map<string, string>
}

export class ContentValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`El contenido tiene ${issues.length} error(es):\n${issues.map((e) => `  - ${e}`).join('\n')}`)
    this.name = 'ContentValidationError'
  }
}

/** Carpeta del contenido: `CONTENT_DIR` o `content/`, relativa a la raíz del proyecto (CLAUDE.md §16). */
export function resolveContentDir(root = process.cwd(), env = process.env): string {
  return path.resolve(root, env['CONTENT_DIR'] || 'content')
}

/** Lee y valida todo el contenido. Lanza `ContentValidationError` con todos los errores juntos. */
export function loadContent(root = process.cwd(), env = process.env): Content {
  const dir = resolveContentDir(root, env)
  const label = path.relative(root, dir) || '.'
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new ContentValidationError([`no existe la carpeta de contenido "${dir}" (revisa CONTENT_DIR)`])
  }
  return buildContent(readContentFiles(dir), label)
}

/** Devuelve los .yaml y .svg de la carpeta, con rutas relativas en formato posix. */
export function readContentFiles(dir: string): Map<string, string> {
  const files = new Map<string, string>()
  for (const entry of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const rel = entry.split(path.sep).join('/')
    if (IMAGE_FILE.test(rel)) files.set(rel, '') // solo importa que exista
    else if (/\.(ya?ml|svg)$/i.test(rel)) files.set(rel, readFileSync(path.join(dir, entry), 'utf8'))
  }
  return files
}

const IMAGE_FILE = /\.(jpe?g|png|webp|avif)$/i

const PLAZA_FILE = /^plazas\/([^/]+)\/plaza\.ya?ml$/
const LOCAL_FILE = /^plazas\/([^/]+)\/locales\/[^/]+\.ya?ml$/
const FLAT_FILE = /^(giros|asesores|presentaciones)\/([^/]+)\.ya?ml$/

/**
 * Valida esquemas y referencias cruzadas a partir de los archivos en memoria.
 * `label` es el prefijo de ruta que aparece en los mensajes de error.
 */
export function buildContent(files: Map<string, string>, label = 'content'): Content {
  const errors: string[] = []
  const todos: Todo[] = []
  const demos = new Map<string, DemoMark[]>()
  const archivos = new Map<string, string>()
  const where = (rel: string) => `${label}/${rel}`

  const parseFile = <T>(rel: string, schema: z.ZodType<T>): T | undefined => {
    let data: unknown
    try {
      data = parse(files.get(rel) ?? '')
    } catch (error) {
      errors.push(`${where(rel)}: YAML inválido: ${(error as Error).message.split('\n')[0]}`)
      return undefined
    }
    const result = schema.safeParse(data)
    if (!result.success) {
      errors.push(...formatIssues(where(rel), result.error))
      return undefined
    }
    return result.data
  }

  const plazas = new Map<string, PlazaEntry>()
  const giros = new Map<string, Giro>()
  const asesores = new Map<string, Asesor>()
  const presentaciones = new Map<string, Presentacion>()
  const localFiles: Array<{ rel: string; plazaSlug: string }> = []

  for (const rel of [...files.keys()].sort()) {
    if (rel.endsWith('.svg') || IMAGE_FILE.test(rel)) continue
    todos.push(...findTodos(where(rel), files.get(rel) ?? ''))
    demos.set(where(rel), findDemos(where(rel), files.get(rel) ?? ''))

    const plazaMatch = PLAZA_FILE.exec(rel)
    const localMatch = LOCAL_FILE.exec(rel)
    const flatMatch = FLAT_FILE.exec(rel)

    if (plazaMatch) {
      const folder = plazaMatch[1]!
      const plaza = parseFile(rel, plazaSchema)
      if (!plaza) continue
      if (plaza.slug !== folder) {
        errors.push(formatIssue(where(rel), ['slug'], `debe coincidir con el nombre de la carpeta ("${folder}")`))
        continue
      }
      const themeErrors = [
        ...validateTheme(where(rel), plaza),
        ...validateImages(where(rel), plazaImageFields(plaza), folder, files),
      ]
      if (themeErrors.length > 0) {
        errors.push(...themeErrors)
        continue
      }
      const planos = readPlans(where(rel), plaza, folder, files, where)
      if (planos.errors.length > 0) {
        errors.push(...planos.errors)
        continue
      }
      plazas.set(plaza.slug, { file: where(rel), plaza, locales: new Map(), planos: planos.planos })
    } else if (localMatch) {
      localFiles.push({ rel, plazaSlug: localMatch[1]! })
    } else if (flatMatch) {
      const [, kind, name] = flatMatch as unknown as [string, string, string]
      archivos.set(`${kind}/${name}`, where(rel))
      if (kind === 'giros') {
        const giro = parseFile(rel, giroSchema)
        if (giro && giro.slug !== name) {
          errors.push(formatIssue(where(rel), ['slug'], `debe coincidir con el nombre del archivo ("${name}")`))
        } else if (giro) giros.set(giro.slug, giro)
      } else if (kind === 'asesores') {
        const asesor = parseFile(rel, asesorSchema)
        if (asesor) asesores.set(name, asesor)
      } else {
        const presentacion = parseFile(rel, presentacionSchema)
        if (presentacion && presentacion.id !== name) {
          errors.push(formatIssue(where(rel), ['id'], `debe coincidir con el nombre del archivo ("${name}")`))
        } else if (presentacion) presentaciones.set(presentacion.id, presentacion)
      }
    } else {
      errors.push(`${where(rel)}: archivo fuera de la estructura de contenido esperada (CLAUDE.md §6)`)
    }
  }

  // Locales: se validan después de las plazas porque dependen de sus niveles y planos.
  for (const { rel, plazaSlug } of localFiles) {
    const local = parseFile(rel, localSchema)
    if (!local) continue
    const entry = plazas.get(plazaSlug)
    if (!entry) {
      errors.push(`${where(rel)}: la plaza "${plazaSlug}" no existe o tiene errores`)
      continue
    }
    if (entry.locales.has(local.clave)) {
      errors.push(formatIssue(where(rel), ['clave'], `el local "${local.clave}" ya está definido en ${entry.locales.get(local.clave)!.file}`))
      continue
    }
    const imageErrors = validateImages(
      where(rel),
      (local.media?.fotos ?? []).map((ruta, i) => ({ path: ['media', 'fotos', i], ruta })),
      plazaSlug,
      files,
    )
    if (imageErrors.length > 0) {
      errors.push(...imageErrors)
      continue
    }
    const nivel = entry.plaza.niveles.find((n) => n.id === local.nivel)
    if (!nivel) {
      const ids = entry.plaza.niveles.map((n) => `"${n.id}"`).join(', ')
      errors.push(formatIssue(where(rel), ['nivel'], `el nivel "${local.nivel}" no existe en la plaza (niveles: ${ids})`))
      continue
    }
    const plan = entry.planos.get(nivel.id)
    const planErrors: string[] = []
    if (plan) {
      if (local.plano_ref !== localId(local.clave)) {
        planErrors.push(formatIssue(where(rel), ['plano_ref'], `debe ser "${localId(local.clave)}" (contrato del plano, CLAUDE.md §7.1.2)`))
      } else if (!plan.info.locales.has(local.clave)) {
        planErrors.push(formatIssue(where(rel), ['plano_ref'], `no existe un elemento con id "${local.plano_ref}" en ${plan.file}`))
      }
    }
    if (local.ruta) {
      if (!plan) {
        planErrors.push(formatIssue(where(rel), ['ruta'], `el nivel "${nivel.id}" no tiene plano todavía`))
      } else if (!plan.info.origenes.has(local.ruta.desde)) {
        const ids = [...plan.info.origenes.keys()].map((id) => `"${id}"`).join(', ')
        planErrors.push(formatIssue(where(rel), ['ruta', 'desde'], `"${local.ruta.desde}" no es un estacionamiento, ancla ni acceso del plano (disponibles: ${ids})`))
      } else if (!plan.info.rutas.some((r) => r.desde === local.ruta!.desde && r.hasta === local.clave)) {
        planErrors.push(formatIssue(where(rel), ['ruta', 'desde'], `${plan.file} no tiene una ruta (<path> en "rutas") de "${local.ruta.desde}" a "${local.clave}"`))
      }
    }
    if (planErrors.length > 0) {
      errors.push(...planErrors)
      continue
    }
    entry.locales.set(local.clave, { file: where(rel), local })
  }

  // Cada local dibujado en un plano necesita datos para su panel: un ocupante o un archivo de local.
  for (const entry of plazas.values()) {
    entry.plaza.niveles.forEach((nivel, i) => {
      const plan = entry.planos.get(nivel.id)
      if (!plan) return
      const conocidos = new Set([...(nivel.ocupantes ?? []).map((o) => o.clave), ...entry.locales.keys()])
      const sinDatos = [...plan.info.locales.keys()].filter((clave) => !conocidos.has(clave))
      if (sinDatos.length > 0) {
        errors.push(formatIssue(entry.file, ['niveles', i, 'ocupantes'], `faltan en ocupantes los locales del plano: ${sinDatos.join(', ')}`))
      }
    })
  }

  // Vecinos: claves de locales del mismo nivel (ocupantes u otros archivos de local).
  for (const entry of plazas.values()) {
    for (const { file, local } of entry.locales.values()) {
      const nivel = entry.plaza.niveles.find((n) => n.id === local.nivel)!
      const delNivel = new Set([
        ...(nivel.ocupantes ?? []).map((o) => o.clave),
        ...[...entry.locales.values()].filter((l) => l.local.nivel === nivel.id).map((l) => l.local.clave),
      ])
      local.vecinos?.forEach((clave, i) => {
        if (clave === local.clave || !delNivel.has(clave)) {
          errors.push(formatIssue(file, ['vecinos', i], `"${clave}" no es un local del nivel "${nivel.id}" (clave de niveles[].ocupantes o de otro local)`))
        }
      })
    }
  }

  // Presentaciones: referencias a plaza, locales, giro y asesor, y tokens únicos.
  const tokenOwners = new Map<string, string>()
  for (const p of presentaciones.values()) {
    const file = where(`presentaciones/${p.id}.yaml`)
    const plaza = plazas.get(p.plaza)
    if (!plaza) errors.push(formatIssue(file, ['plaza'], `la plaza "${p.plaza}" no existe`))
    p.locales.forEach((clave, i) => {
      if (plaza && !plaza.locales.has(clave)) {
        errors.push(formatIssue(file, ['locales', i], `el local "${clave}" no existe en la plaza "${p.plaza}"`))
      }
    })
    if (!giros.has(p.prospecto.giro)) {
      errors.push(formatIssue(file, ['prospecto', 'giro'], `el giro "${p.prospecto.giro}" no existe en giros/`))
    }
    const og = p.seo.imagen_og
    if (og && !isTodo(og) && !/^https:\/\//.test(og)) {
      errors.push(...validateImages(file, [{ path: ['seo', 'imagen_og'], ruta: og }], p.plaza, files))
    }
    if (!asesores.has(p.asesor)) {
      errors.push(formatIssue(file, ['asesor'], `el asesor "${p.asesor}" no existe en asesores/`))
    }
    for (const kind of ['envio', 'revision'] as const) {
      const value = p.tokens[kind]
      const owner = tokenOwners.get(value)
      if (owner) errors.push(formatIssue(file, ['tokens', kind], `el token ya se usa en ${owner}`))
      else tokenOwners.set(value, `${file} › tokens.${kind}`)
    }
  }

  if (errors.length > 0) throw new ContentValidationError(errors)
  const content = { plazas, giros, asesores, presentaciones, todos, demos, archivos }

  // Una presentación "lista" no puede mostrarle ningún TODO al prospecto.
  for (const p of presentaciones.values()) {
    if (p.estado !== 'lista') continue
    const file = where(`presentaciones/${p.id}.yaml`)
    for (const todo of resolvePresentation(content, p.id).pendientes) {
      errors.push(formatIssue(file, ['estado'], `"lista" exige completar ${todo.path} (${todo.text})`))
    }
  }

  if (errors.length > 0) throw new ContentValidationError(errors)
  return content
}

/** Contraste WCAG AA de los pares de texto del tema y fuentes del catálogo. */
export function validateTheme(file: string, plaza: Plaza): string[] {
  const errors: string[] = []
  const { colores, tipografias } = plaza.tema
  for (const { texto, fondo, tipo, ratio, minimo, pasa } of checkContrast(colores)) {
    if (pasa) continue
    const uso = tipo === 'texto' ? '' : ' (gráfica)'
    errors.push(
      formatIssue(file, ['tema', 'colores', texto], `contraste ${ratio.toFixed(2)}:1 sobre "${fondo}"${uso}; WCAG AA exige ${minimo}:1`),
    )
  }
  const fonts = [
    ['display', tipografias.display, 'display'],
    ['cuerpo', tipografias.cuerpo, 'body'],
    ['cita', tipografias.cita, 'quote'],
  ] as const
  for (const [campo, nombre, role] of fonts) {
    if (nombre !== undefined && !isFont(nombre, role)) {
      const disponibles = fontNames(role).map((n) => `"${n}"`).join(', ')
      errors.push(formatIssue(file, ['tema', 'tipografias', campo], `"${nombre}" no está en el catálogo de fuentes (disponibles: ${disponibles})`))
    }
  }
  return errors
}

interface ImageField {
  path: PropertyKey[]
  ruta: string | undefined
}

/** Campos de plaza.yaml que apuntan a imágenes de su carpeta media/. */
export function plazaImageFields(plaza: Plaza): ImageField[] {
  return [
    { path: ['tema', 'logo'], ruta: plaza.tema.logo },
    { path: ['tema', 'icono'], ruta: plaza.tema.icono },
    { path: ['hero', 'imagen'], ruta: plaza.hero.imagen },
    ...plaza.diferenciales.map((d, i) => ({ path: ['diferenciales', i, 'imagen'], ruta: d.imagen })),
    ...(plaza.modulos ?? []).map((m, i) => ({ path: ['modulos', i, 'imagen'], ruta: m.imagen })),
    ...plaza.anclas.map((a, i) => ({ path: ['anclas', i, 'logo'], ruta: a.logo })),
    ...(plaza.directorio ?? []).map((d, i) => ({ path: ['directorio', i, 'logo'], ruta: d.logo })),
  ]
}

/** Toda imagen citada (que no esté en TODO) debe existir en la carpeta de la plaza. */
export function validateImages(file: string, fields: ImageField[], plazaSlug: string, files: Map<string, string>): string[] {
  return fields.flatMap(({ path: field, ruta }) => {
    if (ruta === undefined || isTodo(ruta)) return []
    if (!IMAGE_FILE.test(ruta)) {
      return [formatIssue(file, field, `"${ruta}" no es una imagen (jpg, png, webp o avif)`)]
    }
    const key = path.posix.normalize(`plazas/${plazaSlug}/${ruta}`)
    return files.has(key) ? [] : [formatIssue(file, field, `no existe la imagen "${ruta}" en la carpeta de la plaza`)]
  })
}

/** Lee y valida los planos de nivel de una plaza. */
function readPlans(file: string, plaza: Plaza, slug: string, files: Map<string, string>, where: (rel: string) => string) {
  const errors: string[] = []
  const planos: PlazaEntry['planos'] = new Map()
  plaza.niveles.forEach((nivel, i) => {
    if (isTodo(nivel.plano)) return
    const rel = path.posix.normalize(`plazas/${slug}/${nivel.plano}`)
    const svg = files.get(rel)
    if (svg === undefined) {
      errors.push(formatIssue(file, ['niveles', i, 'plano'], `no existe el plano "${nivel.plano}" en la carpeta de la plaza`))
      return
    }
    const result = readFloorPlan(svg)
    errors.push(...result.errors.map((e) => formatIssue(file, ['niveles', i, 'plano'], `${where(rel)}: ${e}`)))
    if (result.info) {
      const marcas = new Set(plaza.anclas.map((a) => a.marca))
      for (const a of result.info.anclas) {
        if (!marcas.has(a.marca)) errors.push(formatIssue(file, ['niveles', i, 'plano'], `${where(rel)}: el ancla "${a.marca}" no está en anclas de la plaza`))
      }
      planos.set(nivel.id, { file: where(rel), svg, info: result.info })
    }
  })
  return { errors, planos }
}

/** Ids de los elementos de un SVG. */
export function svgIds(svg: string): Set<string> {
  return new Set([...svg.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]!))
}

/** Líneas con TODO (valores o comentarios) para listarlas en el link de revisión. */
export function findTodos(file: string, source: string): Todo[] {
  return source.split('\n').flatMap((line, i) =>
    /\bTODO\b/.test(line) ? [{ file, line: i + 1, text: line.trim().replace(/^#\s*/, '') }] : [],
  )
}

/**
 * Líneas cuyo comentario empieza con `DEMO` (`# DEMO`): valores de demostración (CLAUDE.md §7.6).
 * Una marca en la línea de un bloque (lista u objeto) cuenta una vez y cubre todo el bloque. Un
 * comentario que solo menciona "# DEMO" más adelante no cuenta.
 */
export function findDemos(file: string, source: string): DemoMark[] {
  return source.split('\n').flatMap((line, i) =>
    esMarcaDemo(line) ? [{ file, line: i + 1, text: line.trim() }] : [],
  )
}

/** Línea de comentario: el comentario empieza con DEMO. Línea con valor: su último comentario. */
function esMarcaDemo(line: string): boolean {
  const comentario = line.trimStart().startsWith('#') ? line.trimStart().slice(1) : line.split(/\s#/).slice(1).at(-1)
  return comentario !== undefined && /^\s*DEMO\b/.test(comentario)
}
