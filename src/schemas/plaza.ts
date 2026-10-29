import * as z from 'zod'
import { cssColor, slug, text, url } from './common'

const ubicacion = z.strictObject({
  ciudad: text,
  estado: text,
  direccion: text,
  zona: text,
})

const tema = z.strictObject({
  colores: z.strictObject({
    fondo: cssColor,
    superficie: cssColor,
    texto: cssColor,
    texto_suave: cssColor,
    acento: cssColor,
    linea: cssColor,
  }),
  tipografias: z.strictObject({
    display: text,
    cuerpo: text,
  }),
  logo: text,
  icono: text,
})

const metrica = z.strictObject({
  valor: text,
  etiqueta: text,
  fuente: text,
  periodo: text,
})

const diferencial = z.strictObject({
  titulo: text,
  texto: text,
  imagen: text.optional(),
})

const ancla = z.strictObject({
  marca: text,
  logo: text,
  giro: text,
  area_m2: z.number().positive().optional(),
  local_ref: text.optional(),
})

const marcaDirectorio = z.strictObject({
  marca: text,
  logo: text,
  giro: text,
})

const nivel = z.strictObject({
  id: text,
  nombre: text,
  plano: text,
})

const modulo = z.strictObject({
  id: slug,
  titulo: text,
  texto: text,
  imagen: text.optional(),
})

export const plazaSchema = z
  .strictObject({
    slug,
    nombre: text,
    nombre_completo: text.optional(),
    ubicacion,
    tema,
    frase_principal: text,
    hero: z.strictObject({ imagen: text, alt: text }),
    metricas: z.array(metrica).min(1, 'debe tener al menos una métrica'),
    diferenciales: z.array(diferencial).min(1, 'debe tener al menos un diferencial'),
    anclas: z.array(ancla).min(1, 'debe tener al menos un ancla'),
    directorio: z.array(marcaDirectorio).optional(),
    niveles: z.array(nivel).min(1, 'debe tener al menos un nivel'),
    modulos: z.array(modulo).optional(),
    contacto_general: z.strictObject({
      web: text,
      correo: z.email('debe ser un correo válido'),
      telefono: text,
    }),
    legales: z.strictObject({
      aviso_privacidad_url: url,
      leyenda_imagenes: text,
    }),
  })
  .superRefine((plaza, ctx) => {
    const seen = new Set<string>()
    plaza.niveles.forEach((nivel, i) => {
      if (seen.has(nivel.id)) {
        ctx.addIssue({ code: 'custom', path: ['niveles', i, 'id'], message: `el nivel "${nivel.id}" está repetido` })
      }
      seen.add(nivel.id)
    })
  })

export type Plaza = z.infer<typeof plazaSchema>
