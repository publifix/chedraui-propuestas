import { describe, expect, it } from 'vitest'
import { dedicatoria } from './prospecto'

describe('dedicatoria', () => {
  it('nombra a la persona y a la marca', () => {
    expect(dedicatoria({ destinatario: 'Laura Méndez', marca: 'Rubí Perfumería' })).toBe('Para Laura Méndez · Rubí Perfumería')
  })

  it('no repite la marca si el destinatario ya la nombra', () => {
    expect(dedicatoria({ destinatario: 'Equipo Rubí Perfumería', marca: 'Rubí Perfumería' })).toBe('Para Equipo Rubí Perfumería')
    expect(dedicatoria({ destinatario: 'Equipo  RUBI perfumeria', marca: 'Rubí Perfumería' })).toBe('Para Equipo  RUBI perfumeria')
  })
})
