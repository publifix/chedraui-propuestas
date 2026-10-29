import { describe, expect, it } from 'vitest'
import { isShortText, MAX_UPPERCASE_WORDS, wordCount } from './typography'

describe('regla de mayúsculas (hasta 5 palabras)', () => {
  it('cuenta palabras sin contar signos sueltos', () => {
    expect(wordCount('El Dorado Centro Comercial & Marina')).toBe(5)
    expect(wordCount('Vista previa interna · sin registro')).toBe(5)
    expect(wordCount('Diseño de Legorreta + Legorreta')).toBe(4)
    expect(wordCount('  ')).toBe(0)
  })

  it('permite mayúsculas hasta 5 palabras', () => {
    expect(MAX_UPPERCASE_WORDS).toBe(5)
    expect(isShortText('Para Rubí Perfumería')).toBe(true)
    expect(isShortText('El Dorado Centro Comercial & Marina')).toBe(true)
  })

  it('los textos de más de 5 palabras van en mayúsculas y minúsculas', () => {
    expect(isShortText('Arquitectura firmada por uno de los despachos')).toBe(false)
    expect(isShortText('El lugar donde la Riviera Veracruzana ya viene a comprar')).toBe(false)
  })
})
