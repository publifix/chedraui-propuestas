import { describe, expect, it } from 'vitest'
import { presentationRoutes } from './routes'

const tokens = { envio: 'envioToken1234', revision: 'revisionToken12' }

describe('presentationRoutes', () => {
  it('en borrador solo genera la ruta de revisión', () => {
    expect(presentationRoutes({ estado: 'borrador', tokens })).toEqual([
      { kind: 'revision', token: tokens.revision, path: 'revision/revisionToken12/' },
    ])
  })

  it('en lista genera revisión y envío', () => {
    expect(presentationRoutes({ estado: 'lista', tokens }).map((r) => r.path)).toEqual([
      'revision/revisionToken12/',
      'p/envioToken1234/',
    ])
  })
})
