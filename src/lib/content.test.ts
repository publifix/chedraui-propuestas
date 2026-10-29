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

/** Sustituye todos los TODO de los archivos semilla por valores completos. */
function completarSemilla(): Map<string, string> {
  const files = seedFiles()
  const fill = (value: unknown, key = ''): unknown => {
    if (typeof value === 'string' && value.startsWith('TODO')) {
      if (key === 'ventas_mensuales') return 250000
      if (key === 'min') return 0.08
      if (key === 'max') return 0.12
      if (key === 'aviso_privacidad_url') return 'https://example.com/privacidad'
      return 'Dato completo'
    }
    if (Array.isArray(value)) return value.map((v) => fill(v, key))
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, k)]))
    }
    return value
  }
  for (const rel of Object.values(SEED)) editYaml(files, rel, (d) => Object.assign(d, fill(d)))
  return files
}

describe('estado "lista"', () => {
  it('falla si queda cualquier TODO visible y lista cada campo', () => {
    const files = editYaml(seedFiles(), SEED.presentacion, (d) => (d['estado'] = 'lista'))
    const errors = errorsOf(files)
    const prefix = 'content/presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml › estado: "lista" exige completar'
    expect(errors.every((e) => e.startsWith(prefix))).toBe(true)
    expect(errors).toContain(`${prefix} plaza.frase_principal (TODO: frase principal de apertura de la plaza)`)
    expect(errors).toContain(`${prefix} narrativa.cierre (TODO: redactar cierre)`)
    expect(errors).toContain(`${prefix} escenarios_venta.0.ventas_mensuales (TODO: ventas mensuales)`)
  })

  it('pasa cuando no queda ningún TODO visible', () => {
    const files = editYaml(completarSemilla(), SEED.presentacion, (d) => (d['estado'] = 'lista'))
    expect(() => buildContent(files)).not.toThrow()
  })

  it('no exige completar campos de secciones desactivadas', () => {
    const files = editYaml(completarSemilla(), SEED.plaza, (d) => (d['directorio'][0].logo = 'TODO: logo'))
    editYaml(files, SEED.presentacion, (d) => (d['estado'] = 'lista'))
    expect(errorsOf(files)).toEqual([
      'content/presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml › estado: "lista" exige completar plaza.directorio.0.logo (TODO: logo)',
    ])
    editYaml(files, SEED.presentacion, (d) => (d['secciones'] = ['Portada', 'Condiciones', 'Cierre']))
    expect(() => buildContent(files)).not.toThrow()
  })

  it('en borrador acepta TODO', () => {
    expect(readYaml(seedFiles(), SEED.presentacion)['estado']).toBe('borrador')
    expect(() => buildContent(seedFiles())).not.toThrow()
  })

  it('los comentarios # TODO no bloquean una presentación lista', () => {
    const files = editYaml(completarSemilla(), SEED.presentacion, (d) => (d['estado'] = 'lista'))
    files.set(SEED.local, `# TODO: comentario pendiente\n${files.get(SEED.local)}`)
    expect(() => buildContent(files)).not.toThrow()
  })
})

describe('tema de la plaza', () => {
  it('falla el build si el acento suave no cumple como gráfica', () => {
    const files = editYaml(seedFiles(), SEED.plaza, (d) => (d['tema'].colores.acento_suave = '#e7c6e7'))
    expect(errorsOf(files)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^content\/plazas\/el-dorado\/plaza\.yaml › tema\.colores\.acento_suave: contraste \d\.\d\d:1 sobre "fondo" \(gráfica\); WCAG AA exige 3:1$/,
        ),
      ]),
    )
  })

  it('falla el build si un par de texto sobre fondo no cumple WCAG AA', () => {
    const files = editYaml(seedFiles(), SEED.plaza, (d) => (d['tema'].colores.texto_suave = '#a89fb0'))
    const errors = errorsOf(files)
    expect(errors[0]).toMatch(
      /^content\/plazas\/el-dorado\/plaza\.yaml › tema\.colores\.texto_suave: contraste \d\.\d\d:1 sobre "fondo"; WCAG AA exige 4\.5:1$/,
    )
    expect(errors.some((e) => e.includes('sobre "superficie"'))).toBe(true)
  })

  it('falla si la tipografía no está en el catálogo o tiene otro rol', () => {
    const files = editYaml(seedFiles(), SEED.plaza, (d) => {
      d['tema'].tipografias.display = 'Newsreader'
      d['tema'].tipografias.cuerpo = 'Inter'
      d['tema'].tipografias.cita = 'Archivo'
    })
    const errors = errorsOf(files)
    expect(errors).toContain(
      'content/plazas/el-dorado/plaza.yaml › tema.tipografias.display: "Newsreader" no está en el catálogo de fuentes (disponibles: "Archivo")',
    )
    expect(errors.some((e) => e.includes('tema.tipografias.cuerpo: "Inter"'))).toBe(true)
    expect(errors.some((e) => e.includes('tema.tipografias.cita: "Archivo"'))).toBe(true)
  })
})
