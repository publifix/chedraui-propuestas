import { describe, expect, it } from 'vitest'
import { SECTION_IDS } from './sections'
import { SECCIONES } from '../schemas'

describe('identificadores de sección', () => {
  it('cada sección y el footer tienen un id estable, único y en minúsculas con guiones', () => {
    const ids = Object.values(SECTION_IDS)
    expect(Object.keys(SECTION_IDS)).toEqual([...SECCIONES, 'Footer'])
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/)
  })

  it('no cambian (el tracking del paso 9 depende de ellos)', () => {
    expect(SECTION_IDS).toMatchObject({ Portada: 'portada', BusinessCase: 'business-case', Cierre: 'cierre', Footer: 'footer' })
  })
})
