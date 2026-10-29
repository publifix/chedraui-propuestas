/** Cómo se relaciona un monto con el IVA: sin IVA, con IVA incluido o el IVA mismo. */
export type VatTreatment = 'excluded' | 'included' | 'only'

/** Monto en MXN sin redondear. El redondeo ocurre solo al formatear. */
export interface Money {
  kind: 'money'
  amount: number
  vat: VatTreatment
  /** true cuando depende de un supuesto no garantizado (p. ej. INPC). */
  estimate: boolean
  /** Supuestos aplicados, en español, para mostrarlos junto al monto. */
  assumptions: string[]
}

/** Proporción (0.0978 = 9.78 %) calculada sobre montos con el tratamiento de IVA indicado. */
export interface Ratio {
  kind: 'ratio'
  value: number
  vat: VatTreatment
}

/** Resultado que no se puede calcular porque un dato está en TODO. */
export interface Pending {
  kind: 'pending'
  reason: string
}

export const money = (amount: number, vat: VatTreatment, assumptions: string[] = [], estimate = false): Money => ({
  kind: 'money',
  amount,
  vat,
  estimate,
  assumptions,
})

export const pending = (reason: string): Pending => ({ kind: 'pending', reason })

export const isPending = (value: Money | Ratio | Pending): value is Pending => value.kind === 'pending'
