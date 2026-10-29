import { isTodo, type Seccion } from '../schemas'

export interface TodoValue {
  /** Ruta del campo en el modelo resuelto, p. ej. "plaza.metricas.0.fuente". */
  path: string
  text: string
}

/**
 * Campos del modelo que solo ve el prospecto si la sección correspondiente está activa.
 * Lo que no aparece aquí se considera visible siempre.
 */
const CAMPOS_POR_SECCION: Partial<Record<Seccion, string[]>> = {
  HeroPlaza: ['plaza.hero'],
  Metricas: ['plaza.metricas'],
  Diferenciales: ['plaza.diferenciales'],
  Anclas: ['plaza.anclas'],
  BusinessCase: ['escenarios_venta', 'giro.costo_ocupacion_objetivo'],
  Modulos: ['plaza.modulos'],
  Directorio: ['plaza.directorio'],
}

/** Valores TODO que vería el prospecto, según las secciones activas. */
export function findVisibleTodos(model: unknown, secciones: readonly Seccion[]): TodoValue[] {
  const hidden = Object.entries(CAMPOS_POR_SECCION)
    .filter(([seccion]) => !secciones.includes(seccion as Seccion))
    .flatMap(([, campos]) => campos)
  return findTodoValues(model).filter(
    ({ path }) => !hidden.some((prefix) => path === prefix || path.startsWith(`${prefix}.`)),
  )
}

/** Todos los valores de texto que empiezan con TODO, con su ruta. */
export function findTodoValues(value: unknown, path: string[] = []): TodoValue[] {
  if (isTodo(value)) return [{ path: path.join('.'), text: value }]
  if (Array.isArray(value)) return value.flatMap((item, i) => findTodoValues(item, [...path, String(i)]))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => findTodoValues(item, [...path, key]))
  }
  return []
}
