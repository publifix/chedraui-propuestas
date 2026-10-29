import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { ContentValidationError, loadContent } from './content'

/** Valida el contenido al iniciar el build (lo hace fallar) y al arrancar `pnpm dev` (lo reporta). */
export function contentValidation(): AstroIntegration {
  let root = process.cwd()
  const validate = () => {
    const content = loadContent(root)
    return `Contenido válido: ${content.plazas.size} plaza(s), ${content.presentaciones.size} presentación(es), ${content.todos.length} TODO pendiente(s)`
  }

  return {
    name: 'content-validation',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = fileURLToPath(config.root)
      },
      'astro:build:start': ({ logger }) => {
        logger.info(validate())
      },
      'astro:server:start': ({ logger }) => {
        try {
          logger.info(validate())
        } catch (error) {
          if (!(error instanceof ContentValidationError)) throw error
          logger.error(error.message)
        }
      },
    },
  }
}
