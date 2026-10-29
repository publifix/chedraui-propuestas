// Nombres y roles del catálogo de fuentes, sin los archivos: lo usa la validación del
// contenido, que corre al iniciar el build antes de que Vite resuelva los assets.
export type FontRole = 'display' | 'body' | 'quote'

export const FONT_ROLES = {
  Unbounded: ['display'],
  'Barlow Condensed': ['display'],
  Archivo: ['display', 'body'],
  Figtree: ['body'],
  'Public Sans': ['body'],
  'Instrument Serif': ['quote'],
  Newsreader: ['quote'],
  Fraunces: ['quote'],
} as const satisfies Record<string, readonly FontRole[]>

export type FontName = keyof typeof FONT_ROLES

export function isFont(name: string, role: FontRole): name is FontName {
  const roles = (FONT_ROLES as Record<string, readonly FontRole[]>)[name]
  return roles?.includes(role) ?? false
}

export function fontNames(role: FontRole): FontName[] {
  return (Object.keys(FONT_ROLES) as FontName[]).filter((name) => isFont(name, role))
}
