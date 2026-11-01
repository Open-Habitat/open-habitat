#!/usr/bin/env bash
# Fast local feedback for pure web changes; not a clean or browser/release gate.
set -euo pipefail
if (($#)); then
  echo 'error: test-web-fast.sh takes no arguments; use test:e2e -- --grep for a targeted browser check' >&2
  exit 1
fi
repo=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo"
python3 scripts/generate-ui-reference.py --check
if [[ ! -x web/node_modules/.bin/vitest ]]; then
  echo 'error: web dependencies missing; run npm ci --prefix web first' >&2
  exit 2
fi
for check in check typecheck test; do
  npm run "$check" --prefix web
done
printf 'Web UI reference, static, unit and component checks passed (no browser, Go, packaging or contracts).\n'
