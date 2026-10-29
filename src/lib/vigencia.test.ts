import { describe, expect, it } from 'vitest'
import { formatVigencia, isExpired, localIsoDate } from './vigencia'

describe('vigencia', () => {
  it('sigue vigente durante todo el último día y vence al día siguiente', () => {
    expect(isExpired('2026-11-30', new Date(2026, 10, 30, 23, 59))).toBe(false)
    expect(isExpired('2026-11-30', new Date(2026, 11, 1, 0, 0))).toBe(true)
    expect(isExpired('2026-11-30', new Date(2026, 9, 29))).toBe(false)
  })

  it('usa la fecha local del visitante', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 1, 0))).toBe('2026-01-05')
  })

  it('formatea la fecha en español de México', () => {
    expect(formatVigencia('2026-11-30')).toBe('30 de noviembre de 2026')
  })
})
