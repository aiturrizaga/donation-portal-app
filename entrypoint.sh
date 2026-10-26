#!/bin/sh
# Regenerates ngx-env.js (produced at build time by @ngx-env/builder with
# `runtime: true`) using the container's real environment variables, so the
# same image can be deployed to different environments by changing only the
# variables passed to `docker run`.
#
# Variable names come from .env.template; values come from whatever is
# actually set in the container's environment (`docker run -e NAME=value ...`).
#
# The SSR process itself (dist/server/server.mjs) does not need this file —
# main.server.ts imports '@ngx-env/builder/runtime', which reads process.env
# directly. This script only re-creates the static file the Express server
# serves to the browser for client-side hydration.
set -eu

ENV_TEMPLATE="${ENV_TEMPLATE_FILE:-/app/.env.template}"
OUTPUT="${ENV_OUTPUT_FILE:-/app/dist/browser/ngx-env.js}"

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

body=""
first=true
while IFS='=' read -r key _ || [ -n "$key" ]; do
  key=$(printf '%s' "$key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  case "$key" in
    ''|'#'*) continue ;;
  esac

  value=$(eval "printenv \"$key\"" 2>/dev/null || true)
  escaped=$(json_escape "$value")

  if [ "$first" = true ]; then
    first=false
  else
    body="$body,"
  fi
  body="$body\"$key\":\"$escaped\""
done < "$ENV_TEMPLATE"

echo "globalThis._NGX_ENV_ = {$body};" > "$OUTPUT"

exec "$@"
