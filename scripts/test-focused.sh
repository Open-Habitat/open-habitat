#!/usr/bin/env bash
# Fast selected evidence; intentionally cannot produce a clean-gate receipt.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo"
area='' spec='' tag='' package=''
remote_args=() browser_args=()
usage(){ echo 'usage: scripts/test-focused.sh --area web|browser|go|contracts [--spec <spec>] [--tag <grep>] [--go-package ./internal/<name>] [--writers-paused] [--untracked relative-path] [--idempotency-key key] [--job id] [--wait-timeout seconds]' >&2; exit 2; }
while (($#)); do
  case "$1" in
    --writers-paused) remote_args+=("$1"); shift;;
    --untracked|--idempotency-key|--job|--wait-timeout)
      (($# >= 2)) || usage
      remote_args+=("$1" "$2"); shift 2;;
    --area|--spec|--tag|--go-package)
      (($# >= 2)) || usage
      case "$1" in --area) area=$2;; --spec) spec=$2; browser_args+=(--spec "$2");; --tag) tag=$2; browser_args+=(--tag "$2");; --go-package) package=$2;; esac
      shift 2;;
    *) usage;;
  esac
done
case "$area" in web|browser|go|contracts) ;; *) usage;; esac
if ((${#remote_args[@]})) && [[ $area != browser ]]; then usage; fi
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
    exec python3 "$repo/scripts/browser-focused.py" "${browser_args[@]}" "${remote_args[@]}";;
  go)
    echo 'Focused Go checks; skipped: web, browser, contracts, packaging, clean receipt.' >&2
    go test -race -count=1 "${package:-./internal/...}";;
  contracts)
    echo 'Focused contract checks; skipped: web, browser, Go tests, packaging, clean receipt.' >&2
    ./scripts/check-generated.sh
    python3 scripts/validate-contracts.py;;
esac
