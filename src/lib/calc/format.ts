import type { Money, Pending, Ratio, VatTreatment } from './types'

const LOCALE = 'es-MX'

const currency = (fractionDigits: number) =>
  new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })

const VAT_LABELS: Record<VatTreatment, string> = {
  excluded: '+ IVA',
  included: 'IVA incluido',
  only: 'de IVA',
}

export const PENDING_LABEL = 'Pendiente'

/** "$17,000" o "$218.62": sin centavos cuando el monto redondeado es entero. */
export function formatAmount(amount: number): string {
  const cents = Math.round(amount * 100)
  return currency(cents % 100 === 0 ? 0 : 2).format(cents / 100)
}

export function vatLabel(vat: VatTreatment): string {
  return VAT_LABELS[vat]
}

/** "$19,550 + IVA", "$22,678 IVA incluido", "$3,128 de IVA" o "Pendiente". */
export function formatMoney(value: Money | Pending, { withVat = true } = {}): string {
  if (value.kind === 'pending') return PENDING_LABEL
  const amount = formatAmount(value.amount)
  return withVat ? `${amount} ${vatLabel(value.vat)}` : amount
}

/** "9.8%" o "Pendiente". */
export function formatPercent(value: Ratio | Pending | number, fractionDigits = 1): string {
  if (typeof value === 'object' && value.kind === 'pending') return PENDING_LABEL
  const ratio = typeof value === 'number' ? value : value.value
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(ratio)
}
