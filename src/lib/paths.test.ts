import { describe, expect, it } from 'vitest'
import { joinBase } from './paths'

describe('joinBase', () => {
  it('joins a path to a base with trailing slash', () => {
    expect(joinBase('/chedraui-propuestas/', 'favicon.svg')).toBe('/chedraui-propuestas/favicon.svg')
  })

  it('adds the missing slash after the base', () => {
    expect(joinBase('/chedraui-propuestas', 'p/abc/')).toBe('/chedraui-propuestas/p/abc/')
  })

  it('strips leading slashes from the path', () => {
    expect(joinBase('/chedraui-propuestas/', '/revision/xyz/')).toBe('/chedraui-propuestas/revision/xyz/')
  })

  it('returns the base itself when the path is empty', () => {
    expect(joinBase('/chedraui-propuestas/')).toBe('/chedraui-propuestas/')
    expect(joinBase('/')).toBe('/')
  })
})
