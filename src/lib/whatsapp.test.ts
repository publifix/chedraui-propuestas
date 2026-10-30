import { describe, expect, it } from 'vitest'
import { mensajeCierre, mensajeVencida, whatsappUrl } from './whatsapp'

describe('WhatsApp del cierre', () => {
  it('saluda al asesor por su nombre de pila y menciona la marca y el local', () => {
    const mensaje = mensajeCierre({ asesor: 'Mariana Ortega', marca: 'Rubí Perfumería', locales: ['A25+A26'], plaza: 'El Dorado' })
    expect(mensaje).toBe(
      'Hola, Mariana. Soy de Rubí Perfumería. Ya revisé la propuesta del local A25+A26 en El Dorado y me interesa. ¿Podemos platicarla o agendar una visita al local?',
    )
  })

  it('nombra los dos locales en una comparativa', () => {
    expect(mensajeCierre({ asesor: 'Ana', marca: 'X', locales: ['A1', 'A2'], plaza: 'P' })).toContain('los locales A1 y A2')
  })

  it('arma la liga wa.me con solo dígitos y el mensaje codificado', () => {
    expect(whatsappUrl('+52 229 000 0000', 'Hola A25+A26')).toBe('https://wa.me/522290000000?text=Hola%20A25%2BA26')
  })
})

describe('WhatsApp de propuesta vencida', () => {
  it('pide una propuesta actualizada mencionando marca y local', () => {
    expect(mensajeVencida({ asesor: 'Mariana Ortega', marca: 'Rubí Perfumería', locales: ['A25+A26'], plaza: 'El Dorado' })).toBe(
      'Hola, Mariana. Soy de Rubí Perfumería. La propuesta del local A25+A26 en El Dorado ya venció. ¿Me podrías enviar una actualizada?',
    )
  })
})
