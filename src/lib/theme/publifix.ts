import type { Plaza } from '../../schemas'

/**
 * Tema neutro de Publifix para las páginas que no pertenecen a una plaza (404 e índice).
 * TODO: reemplazar por la identidad oficial de Publifix (logo y colores) cuando se entregue.
 */
export const PUBLIFIX_TEMA: Plaza['tema'] = {
  colores: {
    fondo: '#f6f6f4',
    superficie: '#ffffff',
    texto: '#161616',
    texto_suave: '#5a5a57',
    acento: '#161616',
    acento_suave: '#737376',
    linea: '#dddcd7',
    marca: '#161616',
    texto_marca: '#ffffff',
  },
  tipografias: { display: 'Archivo', cuerpo: 'Archivo' },
  logo: 'TODO: logo de Publifix',
  icono: 'TODO: icono de Publifix',
}
