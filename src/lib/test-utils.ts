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
  asesor: 'asesores/demo.yaml',
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
