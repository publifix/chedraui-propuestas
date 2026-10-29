import * as z from 'zod'

// Mensajes de Zod en español; un campo ausente se reporta como "campo obligatorio".
z.config(z.locales.es())
z.config({
  customError: (issue) =>
    (issue.code === 'invalid_type' || issue.code === 'invalid_value') && issue.input === undefined
      ? 'campo obligatorio'
      : undefined,
})

/** Marcador de dato pendiente. Visible solo en el link de revisión (CLAUDE.md §14). */
export const todoMarker = z
  .string()
  .regex(/^TODO\b/, 'se esperaba un marcador que empiece con "TODO"')

export function isTodo(value: unknown): value is string {
  return typeof value === 'string' && /^TODO\b/.test(value)
}

/** Número que todavía puede estar pendiente de validar (p. ej. cifras de mercado). */
export const pendingNumber = (schema: z.ZodNumber) => z.union([schema, todoMarker])

export const text = z.string().trim().min(1, 'no puede estar vacío')

export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'debe ser un slug en minúsculas con guiones (p. ej. "el-dorado")')

/** Color hex (#rgb, #rrggbb o #rrggbbaa): permite validar el contraste exacto del tema. */
export const cssColor = z
  .string()
  .regex(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i, 'debe ser un color hex (p. ej. "#5b2a86")')

export const url = z.union([z.url('debe ser una URL válida'), todoMarker])

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'debe ser una fecha con formato AAAA-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
  }, 'no es una fecha válida')

export const MIN_TOKEN_LENGTH = 12

export const token = z
  .string()
  .min(MIN_TOKEN_LENGTH, `debe tener al menos ${MIN_TOKEN_LENGTH} caracteres`)
  .regex(/^[A-Za-z0-9_-]+$/, 'solo puede tener letras, números, "-" y "_"')

/** Formatea un error de Zod como líneas "archivo › campo: mensaje". */
export function formatIssues(file: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => formatIssue(file, issue.path, issue.message))
}

export function formatIssue(file: string, path: readonly PropertyKey[], message: string): string {
  const field = path.map(String).join('.')
  return field ? `${file} › ${field}: ${message}` : `${file}: ${message}`
}
