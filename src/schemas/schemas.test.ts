import { describe, expect, it } from 'vitest'
import type * as z from 'zod'
import { asesorSchema, formatIssues, giroSchema, localSchema, plazaSchema, presentacionSchema } from '.'
import { readYaml, SEED, seedFiles } from '../lib/test-utils'

const files = seedFiles()
const seed = (rel: string) => structuredClone(readYaml(files, rel))

/** Mensajes "archivo › campo: mensaje" de un objeto inválido. */
function errorsOf(schema: z.ZodType, data: unknown, file = 'archivo.yaml') {
  const result = schema.safeParse(data)
  expect(result.success).toBe(false)
  return formatIssues(file, result.error!)
}

describe('archivos semilla', () => {
  it.each([
    ['plaza', plazaSchema, SEED.plaza],
    ['local', localSchema, SEED.local],
    ['giro', giroSchema, SEED.giro],
    ['asesor', asesorSchema, SEED.asesor],
    ['presentación', presentacionSchema, SEED.presentacion],
  ] as const)('%s es válido', (_, schema, rel) => {
    expect(schema.safeParse(seed(rel)).success).toBe(true)
  })
})

describe('mensajes de error', () => {
  it('indican archivo y campo de un obligatorio faltante', () => {
    const plaza = seed(SEED.plaza)
    delete plaza['ubicacion'].ciudad
    expect(errorsOf(plazaSchema, plaza, 'content/plazas/el-dorado/plaza.yaml')).toEqual([
      'content/plazas/el-dorado/plaza.yaml › ubicacion.ciudad: campo obligatorio',
    ])
  })

  it('reportan tipo incorrecto en español', () => {
    const local = seed(SEED.local)
    local['area_m2'] = '77.76'
    expect(errorsOf(localSchema, local)[0]).toMatch(/^archivo\.yaml › area_m2: .*se esperaba número/)
  })

  it('rechazan campos que no existen en el modelo', () => {
    const asesor = seed(SEED.asesor)
    asesor['telefono'] = '123'
    expect(errorsOf(asesorSchema, asesor)[0]).toMatch(/Llave desconocida: "telefono"/)
  })

  it('reportan todos los errores a la vez', () => {
    const giro = seed(SEED.giro)
    delete giro['nombre']
    giro['slug'] = 'Perfumería'
    expect(errorsOf(giroSchema, giro)).toHaveLength(2)
  })
})

describe('plaza', () => {
  it('rechaza un color que no es CSS', () => {
    const plaza = seed(SEED.plaza)
    plaza['tema'].colores.acento = 'morado'
    expect(errorsOf(plazaSchema, plaza)[0]).toContain('tema.colores.acento: debe ser un color hex')
  })

  it('rechaza niveles repetidos', () => {
    const plaza = seed(SEED.plaza)
    plaza['niveles'].push({ ...plaza['niveles'][0] })
    expect(errorsOf(plazaSchema, plaza)[0]).toContain('niveles.1.id: el nivel "PB" está repetido')
  })

  it('rechaza un slug con mayúsculas o espacios', () => {
    const plaza = seed(SEED.plaza)
    plaza['slug'] = 'El Dorado'
    expect(errorsOf(plazaSchema, plaza)[0]).toContain('slug: debe ser un slug')
  })

  it('exige al menos una métrica', () => {
    const plaza = seed(SEED.plaza)
    plaza['metricas'] = []
    expect(errorsOf(plazaSchema, plaza)[0]).toContain('metricas: debe tener al menos una métrica')
  })

  it('acepta URL o TODO en el aviso de privacidad, pero no texto libre', () => {
    const plaza = seed(SEED.plaza)
    plaza['legales'].aviso_privacidad_url = 'https://centrocomercialeldorado.mx/privacidad'
    expect(plazaSchema.safeParse(plaza).success).toBe(true)
    plaza['legales'].aviso_privacidad_url = 'pendiente'
    expect(errorsOf(plazaSchema, plaza)[0]).toContain('legales.aviso_privacidad_url')
  })
})

describe('local', () => {
  it('rechaza un estado fuera del catálogo', () => {
    const local = seed(SEED.local)
    local['estado'] = 'rentado'
    expect(errorsOf(localSchema, local)[0]).toMatch(/estado: Opción inválida: se esperaba una de "disponible"\|"apartado"/)
  })

  it('exige el depósito completo', () => {
    const local = seed(SEED.local)
    delete local['condiciones_base'].deposito.incluye_iva
    expect(errorsOf(localSchema, local)).toEqual(['archivo.yaml › condiciones_base.deposito.incluye_iva: campo obligatorio'])
  })

  it('exige el IVA como fracción', () => {
    const local = seed(SEED.local)
    local['condiciones_base'].iva = 16
    expect(errorsOf(localSchema, local)[0]).toContain('condiciones_base.iva: debe expresarse como fracción')
  })
})

describe('giro', () => {
  it('acepta el rango pendiente con TODO', () => {
    expect(giroSchema.safeParse(seed(SEED.giro)).success).toBe(true)
  })

  it('acepta un rango numérico válido y rechaza min > max', () => {
    const giro = seed(SEED.giro)
    giro['costo_ocupacion_objetivo'] = { min: 0.08, max: 0.12 }
    expect(giroSchema.safeParse(giro).success).toBe(true)
    giro['costo_ocupacion_objetivo'] = { min: 0.15, max: 0.12 }
    expect(errorsOf(giroSchema, giro)[0]).toContain('costo_ocupacion_objetivo.min: min no puede ser mayor que max')
  })

  it('rechaza texto que no es número ni TODO', () => {
    const giro = seed(SEED.giro)
    giro['costo_ocupacion_objetivo'].max = 'doce por ciento'
    expect(errorsOf(giroSchema, giro)[0]).toContain('costo_ocupacion_objetivo.max')
  })
})

describe('asesor', () => {
  it('rechaza un WhatsApp sin lada internacional', () => {
    const asesor = seed(SEED.asesor)
    asesor['whatsapp'] = '229 000 0000'
    expect(errorsOf(asesorSchema, asesor)[0]).toContain('whatsapp: debe ser un número con lada internacional')
  })

  it('rechaza un correo inválido', () => {
    const asesor = seed(SEED.asesor)
    asesor['correo'] = 'asesor@'
    expect(errorsOf(asesorSchema, asesor)[0]).toContain('correo: debe ser un correo válido')
  })
})

describe('presentación', () => {
  it('rechaza tokens de menos de 12 caracteres', () => {
    const p = seed(SEED.presentacion)
    p['tokens'].envio = 'corto123'
    expect(errorsOf(presentacionSchema, p)[0]).toContain('tokens.envio: debe tener al menos 12 caracteres')
  })

  it('rechaza tokens con caracteres no válidos en una URL', () => {
    const p = seed(SEED.presentacion)
    p['tokens'].envio = 'token con espacios'
    expect(errorsOf(presentacionSchema, p)[0]).toContain('tokens.envio: solo puede tener letras')
  })

  it('rechaza tokens de envío y revisión iguales', () => {
    const p = seed(SEED.presentacion)
    p['tokens'].revision = p['tokens'].envio
    expect(errorsOf(presentacionSchema, p)).toEqual(['archivo.yaml › tokens.revision: debe ser distinto del token de envío'])
  })

  it('admite uno o dos locales, sin repetir', () => {
    const p = seed(SEED.presentacion)
    p['locales'] = []
    expect(errorsOf(presentacionSchema, p)[0]).toContain('locales: debe incluir al menos un local')
    p['locales'] = ['A1', 'A2', 'A3']
    expect(errorsOf(presentacionSchema, p)[0]).toContain('locales: admite como máximo dos locales')
    p['locales'] = ['A1', 'A1']
    expect(errorsOf(presentacionSchema, p)[0]).toContain('locales: no puede repetir un local')
  })

  it('exige exactamente 3 escenarios de venta', () => {
    const p = seed(SEED.presentacion)
    p['escenarios_venta'].pop()
    expect(errorsOf(presentacionSchema, p)[0]).toContain('escenarios_venta: debe tener exactamente 3 escenarios')
  })

  it('rechaza una vigencia que no es fecha válida', () => {
    const p = seed(SEED.presentacion)
    p['vigencia'] = '2026-02-30'
    expect(errorsOf(presentacionSchema, p)[0]).toContain('vigencia: no es una fecha válida')
    p['vigencia'] = '30/11/2026'
    expect(errorsOf(presentacionSchema, p)[0]).toContain('vigencia: debe ser una fecha con formato AAAA-MM-DD')
  })

  it('rechaza secciones desconocidas o repetidas', () => {
    const p = seed(SEED.presentacion)
    p['secciones'] = ['Portada', 'Testimonios']
    expect(errorsOf(presentacionSchema, p)[0]).toContain('secciones.1: Opción inválida')
    p['secciones'] = ['Portada', 'Portada']
    expect(errorsOf(presentacionSchema, p)[0]).toContain('secciones: no puede repetir una sección')
  })

  it('valida los campos de condiciones que sobrescribe', () => {
    const p = seed(SEED.presentacion)
    p['condiciones'] = { renta_mensual: 15000 }
    expect(presentacionSchema.safeParse(p).success).toBe(true)
    p['condiciones'] = { renta_mensual: -1, area_m2: 80 }
    const errors = errorsOf(presentacionSchema, p)
    expect(errors.some((e) => e.includes('condiciones.renta_mensual'))).toBe(true)
    expect(errors.some((e) => e.includes('Llave desconocida: "area_m2"'))).toBe(true)
  })
})

describe('estado de la presentación', () => {
  it('es obligatorio', () => {
    const p = seed(SEED.presentacion)
    delete p['estado']
    expect(errorsOf(presentacionSchema, p)).toEqual(['archivo.yaml › estado: campo obligatorio'])
  })

  it('solo admite borrador o lista', () => {
    const p = seed(SEED.presentacion)
    p['estado'] = 'enviada'
    expect(errorsOf(presentacionSchema, p)[0]).toMatch(/estado: Opción inválida: se esperaba una de "borrador"\|"lista"/)
  })
})

describe('condiciones de la presentación', () => {
  it('con un local, se definen directo', () => {
    const p = seed(SEED.presentacion)
    p['condiciones'] = { renta_mensual: 15000, meses_gracia: 1 }
    expect(presentacionSchema.safeParse(p).success).toBe(true)
  })

  it('con un local, rechaza la clave del local', () => {
    const p = seed(SEED.presentacion)
    p['condiciones'] = { 'A25+A26': { renta_mensual: 15000 } }
    expect(errorsOf(presentacionSchema, p)).toEqual([
      'archivo.yaml › condiciones: con un solo local las condiciones van directo, sin la clave del local',
    ])
  })

  it('con dos locales, se definen por clave de local', () => {
    const p = seed(SEED.presentacion)
    p['locales'] = ['A25+A26', 'A27']
    p['condiciones'] = { 'A25+A26': { renta_mensual: 15000 }, A27: { meses_gracia: 2 } }
    expect(presentacionSchema.safeParse(p).success).toBe(true)
  })

  it('con dos locales, rechaza el formato plano', () => {
    const p = seed(SEED.presentacion)
    p['locales'] = ['A25+A26', 'A27']
    p['condiciones'] = { renta_mensual: 15000 }
    expect(errorsOf(presentacionSchema, p)[0]).toContain('condiciones: con dos locales las condiciones se definen por clave de local')
  })

  it('con dos locales, rechaza claves que no son locales de la presentación', () => {
    const p = seed(SEED.presentacion)
    p['locales'] = ['A25+A26', 'A27']
    p['condiciones'] = { B1: { renta_mensual: 15000 } }
    expect(errorsOf(presentacionSchema, p)[0]).toContain('las claves deben ser locales de la presentación ("A25+A26", "A27")')
  })

  it('con dos locales, valida los campos de cada local', () => {
    const p = seed(SEED.presentacion)
    p['locales'] = ['A25+A26', 'A27']
    p['condiciones'] = { A27: { renta_mensual: -5 } }
    expect(errorsOf(presentacionSchema, p)[0]).toMatch(/^archivo\.yaml › condiciones\.A27\.renta_mensual: /)
  })
})

describe('incremento anual', () => {
  it('exige el valor como fracción', () => {
    const local = seed(SEED.local)
    local['condiciones_base'].incremento_anual = { tipo: 'fijo', valor: 5 }
    expect(errorsOf(localSchema, local)[0]).toContain('condiciones_base.incremento_anual.valor: debe expresarse como fracción')
    local['condiciones_base'].incremento_anual = { tipo: 'inpc', valor: 0.045 }
    expect(localSchema.safeParse(local).success).toBe(true)
  })
})
