#!/usr/bin/env bash
# Fast selected evidence; intentionally cannot produce a clean-gate receipt.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo"
area='' spec='' tag='' package=''
usage(){ echo 'usage: scripts/test-focused.sh --area web|browser|go|contracts [--spec <spec>] [--tag <grep>] [--go-package ./internal/<name>]' >&2; exit 2; }
while (($#)); do
  case "$1" in
    --area|--spec|--tag|--go-package)
      (($# >= 2)) || usage
      case "$1" in --area) area=$2;; --spec) spec=$2;; --tag) tag=$2;; --go-package) package=$2;; esac
      shift 2;;
    *) usage;;
  esac
done
case "$area" in web|browser|go|contracts) ;; *) usage;; esac
if [[ -n $spec || -n $tag ]] && [[ $area != browser ]]; then usage; fi
if [[ -n $package && $area != go ]]; then usage; fi
if [[ -n $spec && ! $spec =~ ^[a-zA-Z0-9-]+\.spec\.ts$ ]]; then usage; fi
if [[ -n $tag && $tag == -* ]]; then usage; fi
if [[ -n $package && ! $package =~ ^\./internal/[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$ ]]; then usage; fi
case "$area" in
  web)
    echo 'Focused web checks; skipped: Playwright, Go, contracts, packaging, clean receipt.' >&2
    ./scripts/test-web-fast.sh;;
  browser)
    echo 'Focused browser checks; skipped: Go, contracts, packaging, clean receipt (and lab specs unless --spec lab-*.spec.ts).' >&2
    [[ -x web/node_modules/.bin/playwright ]] || { echo 'error: run npm ci --prefix web first' >&2; exit 2; }
    args=()
    if [[ -n $spec ]]; then
      [[ -f web/tests/$spec ]] || { echo "error: unknown spec $spec" >&2; exit 2; }
      args+=("tests/$spec")
    fi
    if [[ -n $tag ]]; then args+=(--grep "$tag"); fi
    if [[ $spec == lab-*.spec.ts ]]; then
      (cd web && npx playwright test --config playwright.lab.config.ts "${args[@]}")
    else
      (cd web && npx playwright test "${args[@]}")
    fi;;
  go)
    echo 'Focused Go checks; skipped: web, browser, contracts, packaging, clean receipt.' >&2
    go test -race -count=1 "${package:-./internal/...}";;
  contracts)
    echo 'Focused contract checks; skipped: web, browser, Go tests, packaging, clean receipt.' >&2
    ./scripts/check-generated.sh
    python3 issues/define-host-contracts/validate_contracts.py
    python3 issues/plan-v1-implementation/validate_plan.py;;
esac
