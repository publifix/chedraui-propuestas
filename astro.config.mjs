// @ts-check
import { defineConfig } from 'astro/config'

// GitHub Pages sirve el repo bajo /chedraui-propuestas/.
// Al conectar el dominio personalizado: cambiar `site` y quitar `base`.
export default defineConfig({
  site: 'https://publifix.github.io',
  base: '/chedraui-propuestas',
  trailingSlash: 'always',
  output: 'static',
})
