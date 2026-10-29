import * as z from 'zod'
import { isTodo, pendingNumber, slug, text } from './common'

const fraccion = z.number().min(0).max(1, 'debe expresarse como fracción (p. ej. 0.12)')

export const giroSchema = z.strictObject({
  slug,
  nombre: text,
  // Rango sano de (renta + mantenimiento) / ventas. No inventar cifras sin fuente: usar TODO.
  costo_ocupacion_objetivo: z
    .strictObject({
      min: pendingNumber(fraccion),
      max: pendingNumber(fraccion),
    })
    .refine(
      ({ min, max }) => isTodo(min) || isTodo(max) || min <= max,
      { message: 'min no puede ser mayor que max', path: ['min'] },
    ),
  angulos_narrativos: z.array(text).optional(),
})

export type Giro = z.infer<typeof giroSchema>
