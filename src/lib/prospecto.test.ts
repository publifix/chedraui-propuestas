import { describe, expect, it } from 'vitest'
import { dedicatoria, remitente } from './prospecto'

describe('remitente', () => {
  it('nombra a la persona y su marca, o solo la marca si es un equipo', () => {
    expect(remitente({ destinatario: 'Gabriela Álvarez', marca: 'Rubí Perfumería' })).toBe('Gabriela Álvarez, de Rubí Perfumería')
    expect(remitente({ destinatario: 'Equipo Rubí Perfumería', marca: 'Rubí Perfumería' })).toBe('de Rubí Perfumería')
  })
})

describe('dedicatoria', () => {
  it('nombra a la persona y a la marca', () => {
    expect(dedicatoria({ destinatario: 'Laura Méndez', marca: 'Rubí Perfumería' })).toBe('Para Laura Méndez · Rubí Perfumería')
  })

  it('no repite la marca si el destinatario ya la nombra', () => {
    expect(dedicatoria({ destinatario: 'Equipo Rubí Perfumería', marca: 'Rubí Perfumería' })).toBe('Para Equipo Rubí Perfumería')
    expect(dedicatoria({ destinatario: 'Equipo  RUBI perfumeria', marca: 'Rubí Perfumería' })).toBe('Para Equipo  RUBI perfumeria')
  })
})
