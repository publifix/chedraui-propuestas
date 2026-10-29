// Nombres y roles del catálogo de fuentes, sin los archivos: lo usa la validación del
// contenido, que corre al iniciar el build antes de que Vite resuelva los assets.
export type FontRole = 'display' | 'body'

export const FONT_ROLES = {
  'Instrument Serif': 'display',
  Gloock: 'display',
  'Bodoni Moda': 'display',
  Jost: 'body',
  Outfit: 'body',
  Urbanist: 'body',
} as const satisfies Record<string, FontRole>

export type FontName = keyof typeof FONT_ROLES

export function isFont(name: string, role: FontRole): name is FontName {
  return (FONT_ROLES as Record<string, FontRole>)[name] === role
}

export function fontNames(role: FontRole): FontName[] {
  return (Object.keys(FONT_ROLES) as FontName[]).filter((name) => FONT_ROLES[name] === role)
}
