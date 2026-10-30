import { describe, expect, it } from 'vitest'
import { cifraDe } from './composicion'

describe('cifraDe', () => {
  it('toma la cifra con su unidad y las palabras que la siguen', () => {
    expect(cifraDe('160 mil m² de construcción')).toEqual({ cifra: '160 mil m²', etiqueta: 'de construcción' })
  })

  it('convierte "más de" en "+"', () => {
    expect(cifraDe('El Dorado Park', 'Más de 50 atracciones, arcade y trampolines.')).toEqual({ cifra: '+50', etiqueta: 'atracciones' })
  })

  it('sin cifras no devuelve nada', () => {
    expect(cifraDe('Marina', 'Club náutico y acceso en yate.')).toBeUndefined()
  })
})
