#!/usr/bin/env bash
# Fast selected evidence; intentionally cannot produce a clean-gate receipt.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
cd "$repo"
# `git bisect run` and hooks export GIT_DIR; a fixture's `git init` inheriting
# it rewrites this repository (bare, from a linked worktree), not its scratch.
unset $(git rev-parse --local-env-vars)
area='' tag='' package=''
browser_args=()
usage(){ echo 'usage: scripts/test-focused.sh --area web|browser|go|contracts [--spec <spec>]... [--tag <grep>] [--lab] [--go-package ./internal/<name>]' >&2; exit 2; }
while (($#)); do
  case "$1" in
    --lab) browser_args+=("$1"); shift;;
    --area|--spec|--tag|--go-package)
      (($# >= 2)) || usage
      case "$1" in --area) area=$2;; --spec) browser_args+=(--spec "$2");; --tag) tag=$2; browser_args+=(--tag "$2");; --go-package) package=$2;; esac
      shift 2;;
    *) usage;;
  esac
done
case "$area" in web|browser|go|contracts) ;; *) usage;; esac
if ((${#browser_args[@]})) && [[ $area != browser ]]; then usage; fi
if [[ -n $package && $area != go ]]; then usage; fi
if [[ -n $tag && $tag == -* ]]; then usage; fi
if [[ -n $package && ! $package =~ ^\./internal/[a-zA-Z0-9_-]+(/[a-zA-Z0-9_-]+)*$ ]]; then usage; fi
umask 077
# Test children get a private disk-backed TMPDIR that leaves with this run,
# short enough for Go tests' sockets; scratch.sh says where. The browser area
# makes its own.
if [[ $area != browser ]]; then
  source "$repo/scripts/scratch.sh"
  oh_short_scratch_dir run_tmp ohf
  trap 'chmod -R u+w "$run_tmp" 2>/dev/null || true; rm -rf "$run_tmp"' EXIT
  export TMPDIR=$run_tmp
fi
# The contract validator, and the Go tests that call it, use the pinned Python
# from requirements-ci.txt, as the clean gate does, not the host's. A caller's
# own $PYTHON is honoured, as the Go tests' hint offers.
if [[ $area == go || $area == contracts ]]; then
  if [[ -z ${PYTHON-} ]]; then
    source "$repo/scripts/ci-python.sh"
    oh_ci_python PYTHON
  fi
  export PYTHON
  # Go fixtures also run python3 directly, not only $PYTHON.
  if [[ $PYTHON == */* ]]; then export PATH="$(dirname "$PYTHON"):$PATH"; fi
fi
case "$area" in
  web)
    echo 'Focused web checks; skipped: Playwright, Go, contracts, packaging, clean receipt.' >&2
    ./scripts/test-web-fast.sh;;
  browser)
    exec python3 "$repo/scripts/browser-focused.py" "${browser_args[@]}";;
  go)
    echo 'Focused Go checks; skipped: web, browser, contracts, packaging, clean receipt.' >&2
    # Daemon tests drive the pinned Pi SDK; install it as the gate does when a
    # fresh worktree lacks it or the lockfile moved, rather than fail on it.
    pi=internal/daemon/pi-device-test
    if [[ (-z $package || $package == ./internal/daemon || $package == ./internal/daemon/*) &&
          ! $pi/node_modules/.package-lock.json -nt $pi/package-lock.json ]]; then
      npm ci --prefix "$pi" --ignore-scripts --prefer-offline --no-audit --no-fund >&2
    fi
    if [[ -n $package ]]; then
      go test -count=1 "$package"
    else
      go test -race -count=1 ./internal/...
    fi;;
  contracts)
    echo 'Focused contract checks; skipped: web, browser, Go tests, packaging, clean receipt.' >&2
    ./scripts/check-generated.sh
    "$PYTHON" scripts/validate-contracts.py;;
esac
