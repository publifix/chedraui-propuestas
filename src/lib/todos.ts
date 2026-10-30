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
  PlanoInteractivo: ['plaza.niveles', 'plaza.region', 'locales.*.ruta'],
}

/**
 * Campos de fotos. Una foto que falta no bloquea el estado "lista" (CLAUDE.md §7.5.2): en revisión
 * se lista como foto pendiente y en el link de envío se sustituye por una composición gráfica.
 */
const CAMPOS_FOTO = ['plaza.hero.imagen', 'plaza.diferenciales.*.imagen', 'plaza.modulos.*.imagen', 'locales.*.media.fotos']

export const esCampoFoto = (path: string) => CAMPOS_FOTO.some((prefix) => matchesPrefix(path, prefix))

/** Valores TODO que vería el prospecto, según las secciones activas (fotos aparte). */
export function findVisibleTodos(model: unknown, secciones: readonly Seccion[]): TodoValue[] {
  const hidden = Object.entries(CAMPOS_POR_SECCION)
    .filter(([seccion]) => !secciones.includes(seccion as Seccion))
    .flatMap(([, campos]) => campos)
  return findTodoValues(model).filter(({ path }) => !esCampoFoto(path) && !hidden.some((prefix) => matchesPrefix(path, prefix)))
}

interface ModeloConFotos {
  plaza: {
    hero: { imagen: string }
    diferenciales: Array<{ titulo: string; imagen?: string | undefined }>
    modulos?: Array<{ titulo: string; imagen?: string | undefined }> | undefined
  }
  locales: Array<{ clave: string; media?: { fotos?: string[] | undefined } | undefined }>
}

/** Fotos que faltan (vacías o en TODO) en las secciones activas. No bloquean "lista". */
export function findFotosPendientes(model: ModeloConFotos, secciones: readonly Seccion[]): TodoValue[] {
  const falta = (ruta: string | undefined) => ruta === undefined || isTodo(ruta)
  const activa = (s: Seccion) => secciones.includes(s)
  return [
    ...(activa('HeroPlaza') && falta(model.plaza.hero.imagen) ? [{ path: 'plaza.hero.imagen', text: 'Foto principal de la plaza' }] : []),
    ...(activa('Diferenciales') ? model.plaza.diferenciales : []).flatMap((d, i) =>
      falta(d.imagen) ? [{ path: `plaza.diferenciales.${i}.imagen`, text: `Diferencial «${d.titulo}»` }] : [],
    ),
    ...(activa('Modulos') ? (model.plaza.modulos ?? []) : []).flatMap((m, i) =>
      falta(m.imagen) ? [{ path: `plaza.modulos.${i}.imagen`, text: `Módulo «${m.titulo}»` }] : [],
    ),
    ...(activa('FichaLocal') ? model.locales : []).flatMap((l, i) => {
      const fotos = l.media?.fotos ?? []
      return fotos.length === 0 || fotos.some(falta) ? [{ path: `locales.${i}.media.fotos`, text: `Fotos del local ${l.clave}` }] : []
    }),
  ]
}

/** "locales.0.ruta.texto" coincide con el prefijo "locales.*.ruta" ("*" = un segmento cualquiera). */
function matchesPrefix(path: string, prefix: string): boolean {
  const p = path.split('.')
  const q = prefix.split('.')
  return q.length <= p.length && q.every((seg, i) => seg === '*' || seg === p[i])
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
