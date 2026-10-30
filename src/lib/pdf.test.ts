import { describe, expect, it } from 'vitest'
import { fechaEmision, folio, nombreArchivoPdf, pdfMeta, rutaImpresion, rutaPdf, segmentoArchivo, urlAbsoluta } from './pdf'

const model = {
  id: '2026-11-rubi-perfumeria-a25-a26',
  plaza: { nombre: 'El Dorado' },
  locales: [{ clave: 'A25+A26' }],
  prospecto: { marca: 'Rubí Perfumería' },
}

describe('PDF de la propuesta', () => {
  it('arma un nombre de archivo legible, sin acentos ni signos', () => {
    expect(segmentoArchivo('Rubí Perfumería')).toBe('Rubi-Perfumeria')
    expect(nombreArchivoPdf(model, 'envio')).toBe('Propuesta-El-Dorado-A25-A26-Rubi-Perfumeria.pdf')
    expect(nombreArchivoPdf(model, 'revision')).toBe('Propuesta-El-Dorado-A25-A26-Rubi-Perfumeria-vista-previa.pdf')
  })

  it('el folio es corto, estable y cambia con el id', () => {
    const f = folio(model)
    expect(f).toMatch(/^ED-[A-Z2-9]{6}$/)
    expect(folio(model)).toBe(f)
    expect(folio({ ...model, id: 'otra' })).not.toBe(f)
  })

  it('cada PDF vive junto a su link y la ruta de impresión debajo de él', () => {
    expect(rutaPdf(model, { kind: 'envio', path: 'p/abc/' })).toBe('p/abc/Propuesta-El-Dorado-A25-A26-Rubi-Perfumeria.pdf')
    expect(rutaPdf(model, { kind: 'revision', path: 'revision/xyz/' })).toMatch(/^revision\/xyz\/.*-vista-previa\.pdf$/)
    expect(rutaImpresion({ path: 'p/abc/' })).toBe('p/abc/imprimir/')
  })

  it('arma la URL absoluta del link para el QR', () => {
    expect(urlAbsoluta('https://publifix.github.io', '/chedraui-propuestas/', 'p/abc/')).toBe('https://publifix.github.io/chedraui-propuestas/p/abc/')
  })

  it('la fecha de emisión es la del día en México', () => {
    // 02:00 UTC del 31 de octubre todavía es 30 de octubre en México.
    expect(fechaEmision(new Date('2026-10-31T02:00:00Z'))).toBe('2026-10-30')
  })

  it('los metadatos nombran a la plaza como autora y el QR lleva al mismo link', () => {
    const meta = pdfMeta({ ...model, plaza: { nombre: 'El Dorado', nombre_completo: 'El Dorado Centro Comercial & Marina' } }, { kind: 'envio', path: 'p/abc/' }, 'https://publifix.github.io', '/chedraui-propuestas/')
    expect(meta.autor).toBe('El Dorado Centro Comercial & Marina')
    expect(meta.titulo).toContain('Rubí Perfumería')
    expect(meta.asunto).toContain('A25+A26')
    expect(meta.archivo).toBe('p/abc/Propuesta-El-Dorado-A25-A26-Rubi-Perfumeria.pdf')
    expect(meta.urlInteractiva).toBe('https://publifix.github.io/chedraui-propuestas/p/abc/')
  })
})
