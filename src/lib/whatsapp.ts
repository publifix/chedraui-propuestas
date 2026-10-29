/** Liga de WhatsApp (wa.me) con mensaje prellenado; el número va solo con dígitos. */
export function whatsappUrl(numero: string, mensaje: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`
}

/** Mensaje inicial del prospecto al asesor: menciona su marca y el local. */
export function mensajeCierre(opts: { asesor: string; marca: string; locales: string[]; plaza: string }): string {
  const locales = opts.locales.length > 1 ? `los locales ${opts.locales.join(' y ')}` : `el local ${opts.locales[0]}`
  return `Hola ${opts.asesor}, le escribo de ${opts.marca}. Revisé la propuesta para ${locales} en ${opts.plaza} y me gustaría platicarla.`
}

/** Mensaje para pedir una propuesta actualizada cuando la vigencia ya pasó. */
export function mensajeVencida(opts: { asesor: string; marca: string; locales: string[]; plaza: string }): string {
  const locales = opts.locales.length > 1 ? `los locales ${opts.locales.join(' y ')}` : `el local ${opts.locales[0]}`
  return `Hola ${opts.asesor}, le escribo de ${opts.marca}. La propuesta para ${locales} en ${opts.plaza} ya venció. ¿Me pueden enviar una propuesta actualizada?`
}
