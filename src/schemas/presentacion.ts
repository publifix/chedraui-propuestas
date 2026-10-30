import * as z from 'zod'
import { condicionesBaseSchema, condicionesOverrideSchema, type CondicionesOverride } from './local'
import { isoDate, pendingNumber, slug, text, token } from './common'

/** Secciones del visor en su orden por defecto (CLAUDE.md §9). El Footer siempre se incluye. */
export const SECCIONES = [
  'Portada',
  'HeroPlaza',
  'Metricas',
  'Diferenciales',
  'Anclas',
  'PlanoInteractivo',
  'FichaLocal',
  'Pivote',
  'Condiciones',
  'BusinessCase',
  'Modulos',
  'Directorio',
  'Galeria',
  'Cierre',
] as const

export type Seccion = (typeof SECCIONES)[number]

/** borrador: solo link de revisión, TODO visibles. lista: sin TODO visibles; se genera el link de envío. */
export const ESTADOS = ['borrador', 'lista'] as const

const CAMPOS_CONDICIONES = new Set(Object.keys(condicionesBaseSchema.shape))

const presentacionBase = z.strictObject({
  id: text,
  estado: z.enum(ESTADOS),
  tokens: z.strictObject({ envio: token, revision: token }),
  plaza: slug,
  locales: z
    .array(text)
    .min(1, 'debe incluir al menos un local')
    .max(2, 'admite como máximo dos locales (comparativa)'),
  prospecto: z.strictObject({
    marca: text,
    destinatario: text,
    giro: slug,
    logo: text.optional(),
  }),
  // Un local: campos de condiciones_base. Dos locales: un objeto por clave de local.
  // Se valida en superRefine porque el formato depende de `locales`.
  condiciones: z.unknown().optional(),
  vigencia: isoDate,
  escenarios_venta: z
    .array(
      z.strictObject({
        nombre: text,
        ventas_mensuales: pendingNumber(z.number().positive()),
      }),
    )
    .length(3, 'debe tener exactamente 3 escenarios'),
  narrativa: z.strictObject({ apertura: text, pivote: text, cierre: text }),
  asesor: slug,
  secciones: z.array(z.enum(SECCIONES)).min(1).optional(),
  // imagen_og (opcional): URL absoluta o imagen de la carpeta de la plaza. Sin ella, el build
  // genera una de 1200×630 con la identidad de la plaza (src/lib/og.ts).
  seo: z.strictObject({ titulo: text, descripcion: text, imagen_og: text.optional() }),
})

/** Condiciones negociadas: planas con un local; por clave de local con dos. */
export type CondicionesPresentacion = CondicionesOverride | Record<string, CondicionesOverride>

export type Presentacion = Omit<z.infer<typeof presentacionBase>, 'condiciones'> & {
  condiciones?: CondicionesPresentacion
}

export const presentacionSchema = presentacionBase
  .superRefine((p, ctx) => {
    if (p.tokens.envio === p.tokens.revision) {
      ctx.addIssue({ code: 'custom', path: ['tokens', 'revision'], message: 'debe ser distinto del token de envío' })
    }
    if (new Set(p.locales).size !== p.locales.length) {
      ctx.addIssue({ code: 'custom', path: ['locales'], message: 'no puede repetir un local' })
    }
    if (p.secciones && new Set(p.secciones).size !== p.secciones.length) {
      ctx.addIssue({ code: 'custom', path: ['secciones'], message: 'no puede repetir una sección' })
    }
    validateCondiciones(p.condiciones, p.locales, ctx)
  })
  .transform((p) => p as Presentacion)

function validateCondiciones(condiciones: unknown, locales: string[], ctx: z.RefinementCtx) {
  if (condiciones === undefined) return
  const keys = condiciones && typeof condiciones === 'object' ? Object.keys(condiciones) : []
  const porLocal = locales.length === 2

  if (porLocal && keys.some((k) => CAMPOS_CONDICIONES.has(k))) {
    ctx.addIssue({
      code: 'custom',
      path: ['condiciones'],
      message: `con dos locales las condiciones se definen por clave de local (p. ej. "${locales[0]}": { renta_mensual: … })`,
    })
    return
  }
  if (!porLocal && keys.some((k) => locales.includes(k))) {
    ctx.addIssue({
      code: 'custom',
      path: ['condiciones'],
      message: 'con un solo local las condiciones van directo, sin la clave del local',
    })
    return
  }

  const schema = porLocal
    ? z.strictObject(Object.fromEntries(locales.map((clave) => [clave, condicionesOverrideSchema.optional()])))
    : condicionesOverrideSchema
  const result = schema.safeParse(condiciones)
  if (result.success) return
  for (const issue of result.error.issues) {
    const message =
      porLocal && issue.code === 'unrecognized_keys'
        ? `${issue.message}; las claves deben ser locales de la presentación (${locales.map((l) => `"${l}"`).join(', ')})`
        : issue.message
    ctx.addIssue({ code: 'custom', path: ['condiciones', ...issue.path], message })
  }
}

/** Condiciones negociadas que aplican a un local de la presentación. */
export function condicionesDeLocal(p: Presentacion, clave: string): CondicionesOverride | undefined {
  if (!p.condiciones) return undefined
  if (p.locales.length === 2) return (p.condiciones as Record<string, CondicionesOverride>)[clave]
  return p.condiciones as CondicionesOverride
}
