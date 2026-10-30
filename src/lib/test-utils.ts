import { readFileSync } from 'node:fs'
import path from 'node:path'
import { parse, stringify } from 'yaml'
import { readContentFiles } from './content'

/** Archivos semilla reales de content/, en memoria, para mutarlos en las pruebas. */
export function seedFiles(): Map<string, string> {
  return readContentFiles(path.resolve(import.meta.dirname, '../../content'))
}

export const SEED = {
  plaza: 'plazas/el-dorado/plaza.yaml',
  local: 'plazas/el-dorado/locales/a25-a26.yaml',
  giro: 'giros/perfumeria.yaml',
  asesor: 'asesores/mariana-ortega.yaml',
  presentacion: 'presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml',
} as const

/** Lee un YAML de `files` como objeto. */
export function readYaml(files: Map<string, string>, rel: string): Record<string, any> {
  return parse(files.get(rel)!)
}

/** Reescribe un YAML de `files` aplicando `mutate` sobre su contenido. */
export function editYaml(files: Map<string, string>, rel: string, mutate: (data: Record<string, any>) => void) {
  const data = readYaml(files, rel)
  mutate(data)
  files.set(rel, stringify(data))
  return files
}

/**
 * Semilla en estado "borrador" con algunos TODO visibles, para probar pendientes y cálculos en
 * pendiente (el contenido real ya está completo y en "lista").
 */
export function semillaEnBorrador(): Map<string, string> {
  const files = seedFiles()
  editYaml(files, SEED.plaza, (d) => (d['frase_principal'] = 'TODO: frase principal de apertura de la plaza'))
  editYaml(files, SEED.giro, (d) => (d['costo_ocupacion_objetivo'] = { min: 'TODO: validar con fuente', max: 'TODO: validar con fuente' }))
  return editYaml(files, SEED.presentacion, (d) => {
    d['estado'] = 'borrador'
    d['narrativa'].cierre = 'TODO: redactar cierre'
    for (const e of d['escenarios_venta']) e.ventas_mensuales = 'TODO: ventas mensuales'
  })
}

/** Sustituye todos los TODO de los archivos semilla por valores completos (para probar "lista"). */
export function completarSemilla(): Map<string, string> {
  const files = semillaEnBorrador()
  const fill = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string' && value.startsWith('TODO')) {
      if (key === 'ventas_mensuales') return 250000
      if (key === 'min') return 0.08
      if (key === 'max') return 0.12
      if (key === 'aviso_privacidad_url') return 'https://example.com/privacidad'
      if (key === 'logo' || key === 'imagen' || key === 'icono') return 'media/fachada-marina.jpg'
      return 'Dato completo'
    }
    if (Array.isArray(value)) return value.map((v) => fill(v, key))
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, k)]))
    }
    return value
  }
  for (const rel of Object.values(SEED)) editYaml(files, rel, (d) => Object.assign(d, fill(d)))
  return files
}

/** Semilla completa más la presentación de prueba en estado "lista" (src/lib/__fixtures__). */
export function contenidoConPresentacionLista(): Map<string, string> {
  const files = completarSemilla()
  files.set('presentaciones/2026-12-prueba-lista.yaml', readFileSync(path.resolve(import.meta.dirname, '__fixtures__/2026-12-prueba-lista.yaml'), 'utf8'))
  return files
}
