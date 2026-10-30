import { describe, expect, it } from 'vitest'
import { acercar, desplazar, escala, igual, limitar, ZOOM_MAXIMO, type Vista } from './vista'

const completa: Vista = [0, 0, 200, 100]

describe('vista del plano', () => {
  it('acerca al doble alrededor del centro', () => {
    expect(acercar(completa, completa, 2)).toEqual([50, 25, 100, 50])
    expect(escala([50, 25, 100, 50], completa)).toBe(2)
  })

  it('mantiene fijo el punto bajo el cursor', () => {
    // El punto en (25 %, 25 %) de la planta (50, 25) sigue en (25 %, 25 %) de la nueva vista.
    const v = acercar(completa, completa, 2, 0.25, 0.25)
    expect(v[0] + v[2] * 0.25).toBeCloseTo(50)
    expect(v[1] + v[3] * 0.25).toBeCloseTo(25)
  })

  it('no aleja más allá de la planta completa ni acerca más del máximo', () => {
    expect(acercar(completa, completa, 0.5)).toEqual(completa)
    const max = acercar(completa, completa, 100)
    expect(escala(max, completa)).toBeCloseTo(ZOOM_MAXIMO)
  })

  it('al desplazar no sale de la planta', () => {
    const v: Vista = [50, 25, 100, 50]
    expect(desplazar(v, completa, -500, 0)).toEqual([0, 25, 100, 50])
    expect(desplazar(v, completa, 0, 500)).toEqual([50, 50, 100, 50])
    // En la planta completa no hay nada que desplazar: el gesto puede seguir a la página.
    expect(igual(desplazar(completa, completa, 10, 10), completa)).toBe(true)
  })

  it('limitar conserva la proporción de la planta', () => {
    const [, , w, h] = limitar([10, 10, 300, 10], completa)
    expect(w / h).toBeCloseTo(2)
  })
})
