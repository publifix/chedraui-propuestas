import { describe, expect, it } from 'vitest'
import { mensajeCierre, mensajeVencida, whatsappUrl } from './whatsapp'

describe('WhatsApp del cierre', () => {
  it('menciona la marca del prospecto y el local', () => {
    const mensaje = mensajeCierre({ asesor: 'Ana', marca: 'Rubí Perfumería', locales: ['A25+A26'], plaza: 'El Dorado' })
    expect(mensaje).toBe('Hola Ana, le escribo de Rubí Perfumería. Revisé la propuesta para el local A25+A26 en El Dorado y me gustaría platicarla.')
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
    expect(mensajeVencida({ asesor: 'Ana', marca: 'Rubí Perfumería', locales: ['A25+A26'], plaza: 'El Dorado' })).toBe(
      'Hola Ana, le escribo de Rubí Perfumería. La propuesta para el local A25+A26 en El Dorado ya venció. ¿Me pueden enviar una propuesta actualizada?',
    )
  })
})
