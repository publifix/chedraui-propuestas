import * as z from 'zod'
import { condicionesBaseSchema } from './local'
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
  'Cierre',
] as const

export type Seccion = (typeof SECCIONES)[number]

export const presentacionSchema = z
  .strictObject({
    id: text,
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
    // Sobrescribe campos de condiciones_base del local. Los objetos (deposito,
    // incremento_anual) se reemplazan completos.
    condiciones: condicionesBaseSchema.partial().optional(),
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
    seo: z.strictObject({ titulo: text, descripcion: text, imagen_og: text }),
  })
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
  })

export type Presentacion = z.infer<typeof presentacionSchema>
