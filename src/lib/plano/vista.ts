// Encuadre del plano interactivo: acercar, alejar y desplazar el viewBox sin salir de la planta.
// Sin dependencias: corre en el navegador (PlanoNivel) y se prueba en Vitest.

/** viewBox como [x, y, ancho, alto], en unidades del SVG. */
export type Vista = [number, number, number, number]

/** Acercamiento máximo respecto a la planta completa. */
export const ZOOM_MAXIMO = 8

/** Cuántas veces está ampliada la vista respecto a la planta completa. */
export function escala(vista: Vista, completa: Vista): number {
  return completa[2] / vista[2]
}

/** Mantiene la vista dentro de la planta completa (misma proporción; nunca más lejos que ella). */
export function limitar([x, y, w, h]: Vista, completa: Vista): Vista {
  const [cx, cy, cw, ch] = completa
  const ancho = Math.min(cw, Math.max(cw / ZOOM_MAXIMO, w))
  const alto = (ancho * ch) / cw
  // Al cambiar el tamaño, conserva el centro de la vista pedida.
  const nx = x + (w - ancho) / 2
  const ny = y + (h - alto) / 2
  return [
    Math.min(Math.max(nx, cx), cx + cw - ancho),
    Math.min(Math.max(ny, cy), cy + ch - alto),
    ancho,
    alto,
  ]
}

/**
 * Acerca (factor > 1) o aleja (factor < 1) manteniendo fijo el punto que está en la fracción
 * (fx, fy) del mapa: el punto bajo el cursor o entre los dedos no se mueve.
 */
export function acercar(vista: Vista, completa: Vista, factor: number, fx = 0.5, fy = 0.5): Vista {
  const [x, y, w, h] = vista
  const cw = completa[2]
  const ancho = Math.min(cw, Math.max(cw / ZOOM_MAXIMO, w / factor))
  const alto = (ancho * h) / w
  const px = x + w * fx
  const py = y + h * fy
  return limitar([px - ancho * fx, py - alto * fy, ancho, alto], completa)
}

/** Desplaza la vista en unidades del SVG (dentro de los límites de la planta). */
export function desplazar([x, y, w, h]: Vista, completa: Vista, dx: number, dy: number): Vista {
  return limitar([x + dx, y + dy, w, h], completa)
}

/** true si dos vistas son prácticamente iguales (para saber si un gesto movió el plano). */
export function igual(a: Vista, b: Vista): boolean {
  return a.every((v, i) => Math.abs(v - b[i]!) < 0.01)
}
