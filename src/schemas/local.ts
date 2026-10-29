import * as z from 'zod'
import { text } from './common'

const deposito = z.strictObject({
  meses: z.number().positive(),
  incluye_mantenimiento: z.boolean(),
  incluye_iva: z.boolean(),
})

// valor como fracción (0.05 = 5 %). Con `inpc` es el supuesto de inflación anual usado para estimar.
const incrementoAnual = z.strictObject({
  tipo: z.enum(['fijo', 'inpc']),
  valor: z.number().min(0).max(1, 'debe expresarse como fracción (p. ej. 0.05)'),
})

export const condicionesBaseSchema = z.strictObject({
  renta_mensual: z.number().positive(),
  mantenimiento_mensual: z.number().min(0),
  iva: z.number().min(0).max(1, 'debe expresarse como fracción (p. ej. 0.16)'),
  deposito,
  incremento_anual: incrementoAnual.optional(),
  plazo_minimo_meses: z.int().positive().optional(),
  meses_gracia: z.int().min(0).optional(),
  giros_permitidos: z.array(text).optional(),
})

export const localSchema = z.strictObject({
  clave: text,
  nivel: text,
  plano_ref: text,
  area_m2: z.number().positive(),
  estado: z.enum(['disponible', 'apartado']),
  condiciones_base: condicionesBaseSchema,
  ficha_tecnica: z
    .strictObject({
      frente_m: z.number().positive().optional(),
      altura_m: z.number().positive().optional(),
      agua: z.boolean().optional(),
      gas: z.boolean().optional(),
      carga_electrica: text.optional(),
      extraccion: z.boolean().optional(),
    })
    .optional(),
  vecinos: z.array(text).optional(),
  media: z
    .strictObject({
      fotos: z.array(text).optional(),
      video: text.optional(),
      tour: text.optional(),
    })
    .optional(),
})

/** Campos de condiciones_base que una presentación puede sobrescribir. */
export const condicionesOverrideSchema = condicionesBaseSchema.partial()

export type CondicionesBase = z.infer<typeof condicionesBaseSchema>
export type CondicionesOverride = z.infer<typeof condicionesOverrideSchema>
export type Local = z.infer<typeof localSchema>
