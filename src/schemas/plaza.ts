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
    // Tono claro del acento para gráficas y rangos (barras de dos tonos).
    acento_suave: cssColor,
    linea: cssColor,
    // Fondo de marca para secciones a sangre y el texto que va sobre él.
    marca: cssColor,
    texto_marca: cssColor,
  }),
  // Nombres del catálogo de src/lib/theme/fonts.ts (se valida al cargar el contenido).
  tipografias: z.strictObject({
    display: text,
    cuerpo: text,
    // Opcional: serif itálica solo para la cita pivote.
    cita: text.optional(),
  }),
  logo: text,
  icono: text,
  // Opcional: sin estos valores se usan los del motor (src/lib/theme/tokens.ts).
  medidas: z
    .strictObject({
      escala: z.number().min(1.1).max(1.6, 'la escala tipográfica debe estar entre 1.1 y 1.6').optional(),
      espacio_base: z.number().min(8).max(24, 'el espacio base debe estar entre 8 y 24 px').optional(),
      radio: z.number().min(0).max(24).optional(),
      linea: z.number().min(0.5).max(4).optional(),
      duracion_ms: z.number().int().min(0).max(2000).optional(),
    })
    .optional(),
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
