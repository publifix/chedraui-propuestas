/**
 * Joins a site-relative path to a base path, avoiding double or missing slashes.
 * Every internal link and asset must go through this so the site works under
 * the GitHub Pages base (/chedraui-propuestas/) and under a future custom domain.
 */
export function joinBase(base: string, path = ''): string {
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  return cleanBase + path.replace(/^\/+/, '')
}

/** `joinBase` bound to the base configured in astro.config.mjs. */
export function withBase(path = ''): string {
  return joinBase(import.meta.env.BASE_URL, path)
}
