import { describe, expect, it } from 'vitest'
import { buildContent } from './content'
import { staticPaths } from './site'
import { contenidoConPresentacionLista, seedFiles, semillaEnBorrador } from './test-utils'

describe('rutas generadas', () => {
  const content = buildContent(contenidoConPresentacionLista())

  it('la presentación de prueba en "lista" pasa la validación', () => {
    expect(content.presentaciones.get('2026-12-prueba-lista')?.estado).toBe('lista')
  })

  it('revisión se genera para toda presentación; envío solo para las que están en "lista"', () => {
    const revision = staticPaths('revision', content).map((r) => r.params.token)
    const envio = staticPaths('envio', content).map((r) => r.params.token)
    expect(revision).toEqual(expect.arrayContaining(['pruebaRevisionTk01']))
    expect(envio).toEqual(expect.arrayContaining(['pruebaEnvioToken01']))
    expect(envio).not.toContain('pruebaRevisionTk01')
  })

  it('Rubí, en "lista", tiene ruta de revisión y de envío; en borrador, solo de revisión', () => {
    const semilla = buildContent(seedFiles())
    expect(staticPaths('revision', semilla).map((r) => r.props.route.path)).toEqual(['revision/qlJayOag7vK0Yncs/'])
    expect(staticPaths('envio', semilla).map((r) => r.props.route.path)).toEqual(['p/-LVqzlD3b5b80Ps0/'])
    const borrador = buildContent(semillaEnBorrador())
    expect(staticPaths('envio', borrador)).toEqual([])
  })

  it('cada ruta lleva su modelo y su path relativo al base', () => {
    const envio = staticPaths('envio', content).find((r) => r.params.token === 'pruebaEnvioToken01')
    expect(envio!.props.model.id).toBe('2026-12-prueba-lista')
    expect(envio!.props.route).toEqual({ kind: 'envio', token: 'pruebaEnvioToken01', path: 'p/pruebaEnvioToken01/' })
  })

  it('un token que no es de ninguna presentación no tiene página (cae en el 404)', () => {
    const tokens = [...staticPaths('revision', content), ...staticPaths('envio', content)].map((r) => r.params.token)
    expect(tokens).not.toContain('tokenInexistente01')
    // El token de envío nunca abre la ruta de revisión ni al revés.
    expect(staticPaths('revision', content).map((r) => r.params.token)).not.toContain('pruebaEnvioToken01')
  })
})
