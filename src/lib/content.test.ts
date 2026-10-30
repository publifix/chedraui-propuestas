import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildContent, ContentValidationError, findDemos, findTodos, loadContent, resolveContentDir } from './content'
import { completarSemilla, editYaml, readYaml, SEED, seedFiles, semillaEnBorrador } from './test-utils'

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
    expect([...content.asesores.keys()]).toEqual(['mariana-ortega'])
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

  it('exige que plano_ref siga el contrato del plano', () => {
    const files = editYaml(seedFiles(), SEED.local, (d) => (d['plano_ref'] = 'a25-a26'))
    expect(errorsOf(files)).toContain('content/plazas/el-dorado/locales/a25-a26.yaml › plano_ref: debe ser "local-a25-a26" (contrato del plano, CLAUDE.md §7.1.2)')
  })

  it('exige que el local esté dibujado en el plano de su nivel', () => {
    const files = seedFiles()
    files.set(SVG, files.get(SVG)!.replace(/<polygon id="local-a25-a26"[^>]*\/>/, '').replace(/<path id="ruta-[^>]*\/>/, ''))
    editYaml(files, SEED.local, (d) => delete d['ruta'])
    expect(errorsOf(files)).toContain(
      'content/plazas/el-dorado/locales/a25-a26.yaml › plano_ref: no existe un elemento con id "local-a25-a26" en content/plazas/el-dorado/planos/pb.svg',
    )
  })

  it('acepta un plano en TODO mientras no exista', () => {
    const files = editYaml(semillaEnBorrador(), SEED.plaza, (d) => (d['niveles'][0].plano = 'TODO: plano'))
    editYaml(files, SEED.local, (d) => delete d['ruta'])
    files.delete(SVG)
    expect(() => buildContent(files)).not.toThrow()
  })

  it('valida la ruta del local contra los orígenes y rutas del plano', () => {
    const files = editYaml(seedFiles(), SEED.local, (d) => (d['ruta'].desde = 'estacionamiento-sur'))
    expect(errorsOf(files)[0]).toMatch(/a25-a26\.yaml › ruta\.desde: "estacionamiento-sur" no es un estacionamiento, ancla ni acceso del plano/)
    const sinRuta = seedFiles()
    sinRuta.set(SVG, sinRuta.get(SVG)!.replace(/<path id="ruta-[^>]*\/>/, ''))
    expect(errorsOf(sinRuta)).toContain(
      'content/plazas/el-dorado/locales/a25-a26.yaml › ruta.desde: content/plazas/el-dorado/planos/pb.svg no tiene una ruta (<path> en "rutas") de "estacionamiento-norte" a "A25+A26"',
    )
  })

  it('exige datos de ocupante para cada local dibujado', () => {
    const files = editYaml(seedFiles(), SEED.plaza, (d) => d['niveles'][0].ocupantes.splice(0, 1))
    expect(errorsOf(files)).toContain('content/plazas/el-dorado/plaza.yaml › niveles.0.ocupantes: faltan en ocupantes los locales del plano: A24')
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

  it('lista los comentarios # TODO del contenido', () => {
    const files = seedFiles()
    files.set(SEED.local, `# TODO: confirmar la regla del depósito\n${files.get(SEED.local)}`)
    const { todos } = buildContent(files)
    expect(todos).toContainEqual({ file: `content/${SEED.local}`, line: 1, text: 'TODO: confirmar la regla del depósito' })
  })
})

describe('DEMO', () => {
  it('cuenta los comentarios # DEMO (no un # dentro de un valor)', () => {
    const demos = findDemos('f.yaml', 'a: 1 # DEMO\nb: "#4405"\nc: # DEMO: bloque\n  - x\n#DEMO\nd: DEMO\n# los valores # DEMO son de demostración\ne: "a # b" # DEMO\n')
    expect(demos.map((d) => d.line)).toEqual([1, 3, 5, 8])
  })
})

describe('estado "lista"', () => {
  it('falla si queda cualquier TODO visible y lista cada campo', () => {
    const files = editYaml(semillaEnBorrador(), SEED.presentacion, (d) => (d['estado'] = 'lista'))
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
    const files = editYaml(completarSemilla(), SEED.plaza, (d) => (d['directorio'][0].giro = 'TODO: giro'))
    editYaml(files, SEED.presentacion, (d) => (d['estado'] = 'lista'))
    expect(errorsOf(files)).toEqual([
      'content/presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml › estado: "lista" exige completar plaza.directorio.0.giro (TODO: giro)',
    ])
    editYaml(files, SEED.presentacion, (d) => (d['secciones'] = ['Portada', 'Condiciones', 'Cierre']))
    expect(() => buildContent(files)).not.toThrow()
  })

  it('en borrador acepta TODO', () => {
    const files = semillaEnBorrador()
    expect(readYaml(files, SEED.presentacion)['estado']).toBe('borrador')
    expect(() => buildContent(files)).not.toThrow()
  })

  it('el contenido real de Rubí está en "lista" y pasa la validación', () => {
    expect(readYaml(seedFiles(), SEED.presentacion)['estado']).toBe('lista')
    expect(() => buildContent(seedFiles())).not.toThrow()
  })

  it('las fotos faltantes no bloquean "lista"; cualquier otro TODO sí', () => {
    const files = editYaml(completarSemilla(), SEED.presentacion, (d) => (d['estado'] = 'lista'))
    editYaml(files, SEED.plaza, (d) => {
      d['hero'].imagen = 'TODO: foto principal'
      d['diferenciales'][0].imagen = 'TODO: foto'
    })
    editYaml(files, SEED.local, (d) => (d['media'] = { fotos: ['TODO: fotos del local'] }))
    expect(() => buildContent(files)).not.toThrow()
    editYaml(files, SEED.plaza, (d) => (d['hero'].alt = 'TODO: texto alternativo'))
    expect(errorsOf(files)).toEqual([
      'content/presentaciones/2026-11-rubi-perfumeria-a25-a26.yaml › estado: "lista" exige completar plaza.hero.alt (TODO: texto alternativo)',
    ])
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

describe('imágenes de la plaza', () => {
  it('la semilla cita imágenes que existen en media/', () => {
    const plaza = readYaml(seedFiles(), SEED.plaza)
    expect(plaza['hero'].imagen).toBe('media/fachada-marina.jpg')
    expect(seedFiles().has('plazas/el-dorado/media/fachada-marina.jpg')).toBe(true)
  })

  it('falla si una imagen citada no existe', () => {
    const files = editYaml(seedFiles(), SEED.plaza, (d) => (d['hero'].imagen = 'media/no-existe.jpg'))
    expect(errorsOf(files)).toContain('content/plazas/el-dorado/plaza.yaml › hero.imagen: no existe la imagen "media/no-existe.jpg" en la carpeta de la plaza')
  })

  it('falla si la ruta no es una imagen', () => {
    const files = editYaml(seedFiles(), SEED.plaza, (d) => (d['diferenciales'][0].imagen = 'media/plano.pdf'))
    expect(errorsOf(files)).toContain('content/plazas/el-dorado/plaza.yaml › diferenciales.0.imagen: "media/plano.pdf" no es una imagen (jpg, png, webp o avif)')
  })

  it('valida también las fotos del local', () => {
    const files = editYaml(seedFiles(), SEED.local, (d) => (d['media'] = { fotos: ['media/local.jpg'] }))
    expect(errorsOf(files)).toContain('content/plazas/el-dorado/locales/a25-a26.yaml › media.fotos.0: no existe la imagen "media/local.jpg" en la carpeta de la plaza')
  })

  it('acepta TODO en lugar de una imagen', () => {
    const files = editYaml(seedFiles(), SEED.plaza, (d) => (d['hero'].imagen = 'TODO: foto'))
    expect(() => buildContent(files)).not.toThrow()
  })
})

describe('contrato del plano', () => {
  const SVG = 'plazas/el-dorado/planos/pb.svg'
  const conPlano = (mutate: (svg: string) => string) => {
    const files = seedFiles()
    files.set(SVG, mutate(files.get(SVG)!))
    return files
  }
  const prefix = 'content/plazas/el-dorado/plaza.yaml › niveles.0.plano: content/plazas/el-dorado/planos/pb.svg:'

  it('el plano de la semilla cumple el contrato', () => {
    expect(buildContent(seedFiles()).plazas.get('el-dorado')!.planos.get('PB')!.info.locales.size).toBe(42)
  })

  it('exige los grupos de capa de nombre fijo', () => {
    expect(errorsOf(conPlano((s) => s.replace('<g id="accesos">', '<g id="entradas">')))).toContain(`${prefix} faltan grupos de capa: <g id="accesos">`)
  })

  it('exige id local-<clave> y data-clave en cada local', () => {
    const errors = errorsOf(conPlano((s) => s.replace('id="local-a24"', 'id="a24"')))
    expect(errors).toContain(`${prefix} el local "A24" debe tener id="local-a24"`)
  })

  it('rechaza contenido inseguro', () => {
    expect(errorsOf(conPlano((s) => s.replace('</svg>', '<script>alert(1)</script></svg>')))).toContain(`${prefix} no puede contener <script>`)
  })

  it('exige la leyenda de plano esquemático', () => {
    expect(errorsOf(conPlano((s) => s.replace(' data-leyenda=""', '')))).toContain(
      `${prefix} "etiquetas" debe incluir la leyenda (elemento con data-leyenda), p. ej. "Plano esquemático, no a escala"`,
    )
  })

  it('las anclas del plano deben existir en la plaza', () => {
    expect(errorsOf(conPlano((s) => s.replace('data-marca="Liverpool"', 'data-marca="Sears"')))).toContain(`${prefix} el ancla "Sears" no está en anclas de la plaza`)
  })
})
