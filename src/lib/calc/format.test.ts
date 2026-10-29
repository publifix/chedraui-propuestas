import { describe, expect, it } from 'vitest'
import { formatAmount, formatMoney, formatPercent, vatLabel } from './format'
import { money, pending } from './types'

describe('formatAmount (es-MX)', () => {
  it('usa $ y separador de miles, sin centavos en montos enteros', () => {
    expect(formatAmount(17000)).toBe('$17,000')
    expect(formatAmount(272136)).toBe('$272,136')
  })

  it('muestra dos decimales cuando hay centavos', () => {
    expect(formatAmount(17000 / 77.76)).toBe('$218.62')
    expect(formatAmount(2550 / 77.76)).toBe('$32.79')
    expect(formatAmount(10.5)).toBe('$10.50')
  })

  it('redondea solo al mostrar, sin arrastrar errores de punto flotante', () => {
    expect(formatAmount(19550 * 1.16)).toBe('$22,678')
    expect(formatAmount(17000 * 1.16)).toBe('$19,720')
  })
})

describe('formatMoney', () => {
  it('indica siempre si incluye o no IVA', () => {
    expect(formatMoney(money(19550, 'excluded'))).toBe('$19,550 + IVA')
    expect(formatMoney(money(22678, 'included'))).toBe('$22,678 IVA incluido')
    expect(formatMoney(money(3128, 'only'))).toBe('$3,128 de IVA')
  })

  it('puede omitir la etiqueta de IVA', () => {
    expect(formatMoney(money(19550, 'excluded'), { withVat: false })).toBe('$19,550')
  })

  it('muestra "Pendiente" para resultados pendientes', () => {
    expect(formatMoney(pending('dato en TODO'))).toBe('Pendiente')
  })

  it('expone las etiquetas de IVA', () => {
    expect(vatLabel('excluded')).toBe('+ IVA')
    expect(vatLabel('included')).toBe('IVA incluido')
  })
})

describe('formatPercent', () => {
  it('formatea proporciones como porcentaje es-MX', () => {
    expect(formatPercent({ kind: 'ratio', value: 19550 / 200000, vat: 'excluded' })).toBe('9.8%')
    expect(formatPercent(0.05)).toBe('5%')
    expect(formatPercent(19550 / 200000, 2)).toBe('9.78%')
  })

  it('muestra "Pendiente" para resultados pendientes', () => {
    expect(formatPercent(pending('dato en TODO'))).toBe('Pendiente')
  })
})
