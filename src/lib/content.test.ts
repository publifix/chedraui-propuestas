import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildContent, ContentValidationError, findTodos, loadContent, resolveContentDir, svgIds } from './content'
import { editYaml, readYaml, SEED, seedFiles } from './test-utils'

/** Errores de validación de `files`; falla si la validación pasa. */
function errorsOf(files: Map<string, string>): string[] {
  try {
    buildContent(files)
  } catch (error) {
    if (error instanceof ContentValidationError) return error.issues
    throw error
  }
  throw new Error('se esperaba un error de validación')
}

const SVG = 'plazas/el-dorado/planos/pb.svg'

describe('contenido semilla', () => {
  it('carga desde content/ sin errores', () => {
    const content = loadContent(path.resolve(import.meta.dirname, '../..'), {})
    expect([...content.plazas.keys()]).toEqual(['el-dorado'])
    expect([...content.plazas.get('el-dorado')!.locales.keys()]).toEqual(['A25+A26'])
    expect([...content.giros.keys()]).toEqual(['perfumeria'])
    expect([...content.asesores.keys()]).toEqual(['demo'])
    expect([...content.presentaciones.keys()]).toEqual(['2026-11-rubi-perfumeria-a25-a26'])
  })

  it('configura el depósito del caso conocido de El Dorado', () => {
    const { local } = buildContent(seedFiles()).plazas.get('el-dorado')!.locales.get('A25+A26')!
    expect(local.condiciones_base.deposito).toEqual({ meses: 1, incluye_mantenimiento: false, incluye_iva: true })
  })
})

describe('CONTENT_DIR', () => {
  it('usa content/ por defecto y respeta la variable', () => {
    expect(resolveContentDir('/repo', {})).toBe('/repo/content')
    expect(resolveContentDir('/repo', { CONTENT_DIR: '../privado/content' })).toBe('/privado/content')
  })

  it('reporta una carpeta inexistente', () => {
    expect(() => loadContent('/repo', { CONTENT_DIR: 'no-existe' })).toThrow(/no existe la carpeta de contenido/)
  })
})

describe('estructura de archivos', () => {
  it('reporta YAML mal formado con su archivo', () => {
    const files = seedFiles().set(SEED.giro, 'slug: [perfumeria')
    expect(errorsOf(files)[0]).toMatch(/^content\/giros\/perfumeria\.yaml: YAML inválido/)
  })

  it('reporta archivos fuera de la estructura', () => {
    const files = seedFiles().set('plazas/notas.yaml', 'a: 1')
    expect(errorsOf(files)).toEqual([
      'content/plazas/notas.yaml: archivo fuera de la estructura de contenido esperada (CLAUDE.md §6)',
    ])
  })

  it('exige que el slug de la plaza coincida con su carpeta', () => {
    const files = editYaml(seedFiles(), SEED.plaza, (d) => (d['slug'] = 'otra-plaza'))
    expect(errorsOf(files)).toContain('content/plazas/el-dorado/plaza.yaml › slug: debe coincidir con el nombre de la carpeta ("el-dorado")')
  })

  it('exige que el slug del giro y el id de la presentación coincidan con el archivo', () => {
    const files = editYaml(seedFiles(), SEED.giro, (d) => (d['slug'] = 'cafeteria'))
    editYaml(files, SEED.presentacion, (d) => (d['id'] = 'otro-id'))
    const errors = errorsOf(files)
    expect(errors).toContain('content/giros/perfumeria.yaml › slug: debe coincidir con el nombre del archivo ("perfumeria")')
    expect(errors).toContain('content/presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml › id: debe coincidir con el nombre del archivo ("2026-11-rubi-perfumeria-a25-a26")')
  })

  it('rechaza dos archivos con la misma clave de local', () => {
    const files = seedFiles()
    files.set('plazas/el-dorado/locales/copia.yaml', files.get(SEED.local)!)
    expect(errorsOf(files)[0]).toMatch(/locales\/copia\.yaml › clave: el local "A25\+A26" ya está definido/)
  })
})

describe('referencias del local', () => {
  it('exige que el nivel exista en la plaza', () => {
    const files = editYaml(seedFiles(), SEED.local, (d) => (d['nivel'] = 'N1'))
    expect(errorsOf(files)).toContain('content/plazas/el-dorado/locales/a25-a26.yaml › nivel: el nivel "N1" no existe en la plaza (niveles: "PB")')
  })

  it('no valida plano_ref mientras el SVG del nivel no exista', () => {
    expect(seedFiles().has(SVG)).toBe(false)
    expect(() => buildContent(seedFiles())).not.toThrow()
  })

  it('valida plano_ref contra los ids del SVG cuando existe', () => {
    const ok = seedFiles().set(SVG, '<svg><rect id="local-a25-a26"/></svg>')
    expect(() => buildContent(ok)).not.toThrow()

    const missing = seedFiles().set(SVG, '<svg><rect id="local-a23"/></svg>')
    expect(errorsOf(missing)).toContain(
      'content/plazas/el-dorado/locales/a25-a26.yaml › plano_ref: no existe un elemento con id "local-a25-a26" en content/plazas/el-dorado/planos/pb.svg',
    )
  })

  it('extrae los ids del SVG', () => {
    expect(svgIds(`<svg id="pb"><g id='a1'><path id="a2" /></g></svg>`)).toEqual(new Set(['pb', 'a1', 'a2']))
  })
})

describe('referencias de la presentación', () => {
  it('exige que la plaza exista', () => {
    const files = editYaml(seedFiles(), SEED.presentacion, (d) => (d['plaza'] = 'galerias'))
    expect(errorsOf(files)).toEqual(['content/presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml › plaza: la plaza "galerias" no existe'])
  })

  it('exige que los locales existan en la plaza', () => {
    const files = editYaml(seedFiles(), SEED.presentacion, (d) => (d['locales'] = ['A25+A26', 'B9']))
    expect(errorsOf(files)).toEqual(['content/presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml › locales.1: el local "B9" no existe en la plaza "el-dorado"'])
  })

  it('exige que el giro exista', () => {
    const files = editYaml(seedFiles(), SEED.presentacion, (d) => (d['prospecto'].giro = 'cafeteria'))
    expect(errorsOf(files)).toEqual(['content/presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml › prospecto.giro: el giro "cafeteria" no existe en giros/'])
  })

  it('exige que el asesor exista', () => {
    const files = editYaml(seedFiles(), SEED.presentacion, (d) => (d['asesor'] = 'juan-perez'))
    expect(errorsOf(files)).toEqual(['content/presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml › asesor: el asesor "juan-perez" no existe en asesores/'])
  })

  it('rechaza tokens repetidos entre presentaciones', () => {
    const files = seedFiles()
    const original = readYaml(files, SEED.presentacion)
    const rel = 'presentaciones/2026-11-otra.yaml'
    files.set(rel, files.get(SEED.presentacion)!)
    editYaml(files, rel, (d) => {
      d['id'] = '2026-11-otra'
      d['tokens'] = { envio: 'nuevoTokenEnvio1', revision: original['tokens'].envio }
    })
    expect(errorsOf(files)).toEqual([
      'content/presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml › tokens.envio: el token ya se usa en content/presentaciones/2026-11-otra.yaml › tokens.revision',
    ])
  })
})

describe('TODO', () => {
  it('encuentra marcadores en valores y comentarios con su línea', () => {
    const todos = findTodos('f.yaml', 'a: 1\n# TODO: dato pendiente\nb: "TODO: otro"\n')
    expect(todos).toEqual([
      { file: 'f.yaml', line: 2, text: 'TODO: dato pendiente' },
      { file: 'f.yaml', line: 3, text: 'b: "TODO: otro"' },
    ])
  })

  it('el contenido semilla lista sus pendientes', () => {
    const { todos } = buildContent(seedFiles())
    expect(todos.some((t) => t.text.includes('confirmar la regla del depósito'))).toBe(true)
  })
})
