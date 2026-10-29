import * as z from 'zod'
import { text } from './common'

export const asesorSchema = z.strictObject({
  nombre: text,
  puesto: text.optional(),
  // Número internacional, p. ej. "+52 229 000 0000"; espacios y guiones permitidos.
  whatsapp: z
    .string()
    .refine((v) => /^\+\d{10,15}$/.test(v.replace(/[\s-]/g, '')), 'debe ser un número con lada internacional (p. ej. "+52 229 000 0000")'),
  correo: z.email('debe ser un correo válido').optional(),
})

export type Asesor = z.infer<typeof asesorSchema>
