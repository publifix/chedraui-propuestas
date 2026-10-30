/** Liga de WhatsApp (wa.me) con mensaje prellenado; el número va solo con dígitos. */
export function whatsappUrl(numero: string, mensaje: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`
}

/** Nombre de pila del asesor, como se saluda en un mensaje de WhatsApp. */
const nombreDePila = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre

const textoLocales = (locales: string[]) => (locales.length > 1 ? `de los locales ${locales.join(' y ')}` : `del local ${locales[0]}`)

/** Mensaje inicial del prospecto al asesor: saluda por su nombre y menciona su marca y el local. */
export function mensajeCierre(opts: { asesor: string; marca: string; locales: string[]; plaza: string }): string {
  return `Hola, ${nombreDePila(opts.asesor)}. Soy de ${opts.marca}. Ya revisé la propuesta ${textoLocales(opts.locales)} en ${opts.plaza} y me interesa. ¿Podemos platicarla o agendar una visita al local?`
}

/** Mensaje para pedir una propuesta actualizada cuando la vigencia ya pasó. */
export function mensajeVencida(opts: { asesor: string; marca: string; locales: string[]; plaza: string }): string {
  return `Hola, ${nombreDePila(opts.asesor)}. Soy de ${opts.marca}. La propuesta ${textoLocales(opts.locales)} en ${opts.plaza} ya venció. ¿Me podrías enviar una actualizada?`
}
