import { defineConfig } from 'astro/config'
import { contentValidation } from './src/lib/content-validation'

// GitHub Pages sirve el repo bajo /chedraui-propuestas/.
// Al conectar el dominio personalizado: cambiar `site` y quitar `base`.
export default defineConfig({
  site: 'https://publifix.github.io',
  base: '/chedraui-propuestas',
  trailingSlash: 'always',
  output: 'static',
  integrations: [contentValidation()],
})
