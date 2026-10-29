import { describe, expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import { expiryScript, formatVigencia, isExpired, localIsoDate } from './vigencia'

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

describe('script de vigencia del <head>', () => {
  /** Ejecuta el script con una fecha fija y devuelve si marcó la página como vencida. */
  const corre = (vigencia: string, now: Date) => {
    const classes = new Set<string>()
    const RealDate = Date
    class FixedDate extends RealDate {
      constructor() {
        super(now.getTime())
      }
    }
    runInNewContext(expiryScript(vigencia), { Date: FixedDate, String, document: { documentElement: { classList: { add: (c: string) => classes.add(c) } } } })
    return classes.has('is-vencida')
  }

  it('aplica la misma regla que isExpired', () => {
    for (const now of [new Date(2026, 10, 29, 12), new Date(2026, 10, 30, 23, 59), new Date(2026, 11, 1, 0, 1), new Date(2027, 0, 15)]) {
      expect(corre('2026-11-30', now)).toBe(isExpired('2026-11-30', now))
    }
  })

  it('rechaza una vigencia mal formada (no se inyecta texto arbitrario)', () => {
    expect(() => expiryScript('2026-11-30");alert(1);("')).toThrow('vigencia inválida')
  })
})
