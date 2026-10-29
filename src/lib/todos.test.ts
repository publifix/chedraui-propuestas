import { describe, expect, it } from 'vitest'
import { findTodoValues, findVisibleTodos } from './todos'

const model = {
  narrativa: { pivote: 'TODO: pivote' },
  plaza: { directorio: [{ logo: 'TODO: logo' }], nombre: 'El Dorado' },
  numero: 3,
}

describe('TODO en el modelo', () => {
  it('encuentra valores TODO anidados con su ruta', () => {
    expect(findTodoValues(model)).toEqual([
      { path: 'narrativa.pivote', text: 'TODO: pivote' },
      { path: 'plaza.directorio.0.logo', text: 'TODO: logo' },
    ])
  })

  it('omite los campos de secciones desactivadas', () => {
    expect(findVisibleTodos(model, ['Portada', 'Pivote']).map((t) => t.path)).toEqual(['narrativa.pivote'])
    expect(findVisibleTodos(model, ['Directorio']).map((t) => t.path)).toContain('plaza.directorio.0.logo')
  })
})

describe('comodines en las rutas de sección', () => {
  it('locales.*.ruta oculta los TODO de la ruta de cualquier local si el plano está desactivado', () => {
    const m = { locales: [{ ruta: { texto: 'TODO: cercanía' } }] }
    expect(findVisibleTodos(m, ['Portada'])).toEqual([])
    expect(findVisibleTodos(m, ['PlanoInteractivo']).map((t) => t.path)).toEqual(['locales.0.ruta.texto'])
  })
})
