#!/bin/bash
# Prepara sesiones en la nube: Node 24 (requerido por Astro) + dependencias.
set -euo pipefail
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "$CLAUDE_PROJECT_DIR"

if [ -s /opt/nvm/nvm.sh ]; then
  source /opt/nvm/nvm.sh
  nvm install 24 >/dev/null
  NODE_BIN="$(dirname "$(nvm which 24)")"
  [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export PATH=\"$NODE_BIN:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  export PATH="$NODE_BIN:$PATH"
fi
[ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export ASTRO_TELEMETRY_DISABLED=1" >> "$CLAUDE_ENV_FILE"

corepack enable >/dev/null 2>&1 || npm i -g pnpm@10.28.0 >/dev/null
pnpm install --frozen-lockfile
