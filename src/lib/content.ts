import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { resolvePresentation } from './resolve'
import { checkContrast } from './theme/contrast'
import { fontNames, isFont } from './theme/font-roles'
import type * as z from 'zod'
import {
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
}

export interface Todo {
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
    if (!/\.(ya?ml|svg)$/i.test(rel)) continue
    files.set(rel, readFileSync(path.join(dir, entry), 'utf8'))
  }
  return files
}

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
    if (rel.endsWith('.svg')) continue
    todos.push(...findTodos(where(rel), files.get(rel) ?? ''))

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
      const themeErrors = validateTheme(where(rel), plaza)
      if (themeErrors.length > 0) {
        errors.push(...themeErrors)
        continue
      }
      plazas.set(plaza.slug, { file: where(rel), plaza, locales: new Map() })
    } else if (localMatch) {
      localFiles.push({ rel, plazaSlug: localMatch[1]! })
    } else if (flatMatch) {
      const [, kind, name] = flatMatch as unknown as [string, string, string]
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
    const nivel = entry.plaza.niveles.find((n) => n.id === local.nivel)
    if (!nivel) {
      const ids = entry.plaza.niveles.map((n) => `"${n.id}"`).join(', ')
      errors.push(formatIssue(where(rel), ['nivel'], `el nivel "${local.nivel}" no existe en la plaza (niveles: ${ids})`))
      continue
    }
    const svgPath = path.posix.normalize(`plazas/${plazaSlug}/${nivel.plano}`)
    const svg = files.get(svgPath)
    if (svg !== undefined && !svgIds(svg).has(local.plano_ref)) {
      errors.push(formatIssue(where(rel), ['plano_ref'], `no existe un elemento con id "${local.plano_ref}" en ${where(svgPath)}`))
      continue
    }
    entry.locales.set(local.clave, { file: where(rel), local })
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
  const content = { plazas, giros, asesores, presentaciones, todos }

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
