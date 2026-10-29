import { defineConfig } from 'astro/config'
import { contentValidation } from './src/lib/content-validation'
import { resolveContentDir } from './src/lib/content'

// GitHub Pages sirve el repo bajo /chedraui-propuestas/.
// Al conectar el dominio personalizado: cambiar `site` y quitar `base`.
export default defineConfig({
  site: 'https://publifix.github.io',
  base: '/chedraui-propuestas',
  trailingSlash: 'always',
  output: 'static',
  integrations: [contentValidation()],
  vite: {
    resolve: {
      // Las imágenes del contenido se importan desde CONTENT_DIR (CLAUDE.md §16) para que
      // el pipeline de Astro las optimice; ver src/lib/media.ts.
      alias: { '@content': resolveContentDir(import.meta.dirname) },
    },
  },
})
