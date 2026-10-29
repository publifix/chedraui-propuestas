import type { Seccion } from '../schemas'

/** Identificador estable de cada sección para data-section y el tracking (paso 9). No cambiar. */
export const SECTION_IDS: Record<Seccion | 'Footer', string> = {
  Portada: 'portada',
  HeroPlaza: 'hero-plaza',
  Metricas: 'metricas',
  Diferenciales: 'diferenciales',
  Anclas: 'anclas',
  PlanoInteractivo: 'plano-interactivo',
  FichaLocal: 'ficha-local',
  Pivote: 'pivote',
  Condiciones: 'condiciones',
  BusinessCase: 'business-case',
  Modulos: 'modulos',
  Directorio: 'directorio',
  Cierre: 'cierre',
  Footer: 'footer',
}
