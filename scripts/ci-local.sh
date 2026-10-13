#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
clean=false;json=false;no_reuse=false
while (($#));do case "$1" in --clean)clean=true;shift;;--json)json=true;shift;;--no-reuse)no_reuse=true;shift;;*)echo "error: unknown argument $1" >&2;exit 1;;esac;done
cd "$repo"
if $clean && [[ -n $(git status --short) ]];then echo 'error: --clean requires a clean tree at entry' >&2;exit 1;fi
# A prior complete gate on the identical committed tree is local evidence for
# unchanged phase inputs. The full tree is the conservative input hash: no
# narrower list can safely omit fixtures, scripts or package metadata.
reuse_phases=false
if $clean && ! $no_reuse && python3 scripts/gate-receipt.py check >/dev/null 2>&1;then reuse_phases=true;fi
# Build caches, npm installs and test children must not exhaust the /tmp tmpfs.
export TMPDIR=/var/tmp
tmp=$(mktemp -d)
# Content-addressed build/download caches are disposable, but survive consecutive
# runs in this checkout. HOME and the Python/tool installs remain private per run.
export HOME="$tmp/home" GOCACHE="$repo/.cache/ci-local/go-build" GOMODCACHE="$repo/.cache/ci-local/go-mod" NPM_CONFIG_CACHE="$repo/.cache/ci-local/npm" PLAYWRIGHT_BROWSERS_PATH="$repo/.cache/ms-playwright" CI=1
# Go's default module cache is read-only; worktree teardown must be able to remove it.
export GOFLAGS="${GOFLAGS:+$GOFLAGS }-modcacherw"
mkdir -p "$HOME" "$GOCACHE" "$GOMODCACHE" "$NPM_CONFIG_CACHE" "$PLAYWRIGHT_BROWSERS_PATH" "$tmp/bin"
phase_name=setup
phase_start=$(date +%s)
phase(){
  local now
  now=$(date +%s)
  printf 'ci-local phase %s: %ss\n' "$phase_name" "$((now-phase_start))" >&2
  phase_name=$1
  phase_start=$now
}
cleanup(){
  local rc=$? now
  now=$(date +%s)
  printf 'ci-local phase %s: %ss (exit %s)\n' "$phase_name" "$((now-phase_start))" "$rc" >&2
  chmod -R u+w "$tmp" 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT
# Every non-system tool is fetched into disposable storage and checksum/version checked.
# CI requires the pinned issuectl even when a newer machine CLI is present.
# Never install into a persistent machine path.
  issue_archive="$tmp/issuectl.tar.xz"
  curl -fsSL --retry 3 --retry-all-errors https://github.com/jarimustonen/issuectl/releases/download/v0.19.0/issuectl-x86_64-unknown-linux-musl.tar.xz -o "$issue_archive"
  echo '75d5fa1b1c20cae557ab90948788f19af88bf14dfa215a538abc6096673976ef  '"$issue_archive" | sha256sum -c -
  tar -xJf "$issue_archive" -C "$tmp"
  cp "$tmp/issuectl-x86_64-unknown-linux-musl/issuectl" "$tmp/bin/issuectl"
export PATH="$tmp/bin:$PATH"
python3 -m venv "$tmp/venv"
"$tmp/venv/bin/pip" install --disable-pip-version-check --no-input -r requirements-ci.txt
export PYTHON="$tmp/venv/bin/python"
go version
node --version
npm --version
issuectl --version | grep -Fx 'issuectl 0.19.0'
phase dependencies
go mod download
export GOPROXY=off
npm ci --prefix web
rm -rf web/node_modules
npm ci --offline --prefix web
# The mapped-UID Pi helper runs the pinned native SDK against a network-trapped synthetic provider.
npm ci --prefix internal/daemon/pi-device-test --ignore-scripts --no-audit --no-fund
node --test internal/daemon/pi-device-test/helper.test.mjs
npm exec --prefix web playwright install chromium
phase web-checks
npm run format:check --prefix web
npm run lint --prefix web
npm run typecheck --prefix web
npm run test:unit --prefix web
npm run test:component --prefix web
# Build once before Playwright: the same fresh production assets are served by
# the synthetic host and later packaged. Standalone Playwright still builds.
npm run build --prefix web
if grep -R -E 'Alder-testifixture|Deterministinen testi: daemon' web/dist/assets;then
  echo 'error: test fixture content leaked into production bundle' >&2;exit 1
fi
# Browser and Go/contracts read the same built assets but write separate outputs.
# Keep separate logs so failures in either child are reported even when both fail.
phase browser-and-go-contracts
if ! $reuse_phases;then
  (
    start=$SECONDS
    trap 'echo "ci-local phase browser: $((SECONDS-start))s"' EXIT
    OH_WEB_PREBUILT=1 npm run test:browser --prefix web
    (cd web && OH_WEB_PREBUILT=1 npx playwright test --config playwright.lab.config.ts)
  ) >"$tmp/browser.log" 2>&1 & browser_pid=$!
  (
    start=$SECONDS
    trap 'echo "ci-local phase go-and-contracts: $((SECONDS-start))s"' EXIT
    npm run build-storybook --prefix web
    go fmt ./...
    go vet ./...
    go test -race ./...
    CGO_ENABLED=0 go build -trimpath ./cmd/open-habitat
    rm -f open-habitat
    go generate ./internal/contracts
    ./scripts/check-generated.sh
    "$PYTHON" issues/define-host-contracts/validate_contracts.py
    "$PYTHON" issues/plan-v1-implementation/validate_plan.py
    "$PYTHON" issues/plan-v1-implementation/test_validate_plan.py
    "$PYTHON" scripts/validate-project-view.py
    "$PYTHON" scripts/check-licenses.py
    "$PYTHON" scripts/test-gate-receipt.py
    ./scripts/vm-test.sh self-test --json
  ) >"$tmp/go-and-contracts.log" 2>&1 & go_pid=$!
  browser_rc=0; go_rc=0
  wait "$browser_pid" || browser_rc=$?
  wait "$go_pid" || go_rc=$?
  cat "$tmp/browser.log" "$tmp/go-and-contracts.log"
  if ((browser_rc || go_rc));then
    echo "error: browser exit=$browser_rc; Go/contracts exit=$go_rc" >&2
    exit 1
  fi
else
  echo 'ci-local phase browser and go-and-contracts: reused from passed receipt for identical committed tree' >&2
fi
phase packaging
./scripts/native-fixture.sh create --output "$tmp/native-fixture"
test "$(wc -l < "$tmp/native-fixture/home/.pi/agent/sessions/fixture.jsonl")" -eq 2500
rm -rf dist;mkdir -p dist/one dist/two
./scripts/package-release.sh --version 0.0.0-test --target linux-amd64 --web-dir web/dist --output dist/one
./scripts/package-release.sh --version 0.0.0-test --target linux-amd64 --web-dir web/dist --output dist/two
cmp dist/one/open-habitat-0.0.0-test-linux-amd64.tar.gz dist/two/open-habitat-0.0.0-test-linux-amd64.tar.gz
./scripts/verify-release.sh --archive dist/one/open-habitat-0.0.0-test-linux-amd64.tar.gz --json
bash scripts/test-package-socket.sh dist/one/open-habitat-0.0.0-test-linux-amd64.tar.gz
mkdir -p "$tmp/relocated";cp dist/one/open-habitat-0.0.0-test-linux-amd64.tar.gz* "$tmp/relocated/"
./scripts/verify-release.sh --archive "$tmp/relocated/open-habitat-0.0.0-test-linux-amd64.tar.gz" --json
printf 'tampered' >> "$tmp/relocated/open-habitat-0.0.0-test-linux-amd64.tar.gz"
if ./scripts/verify-release.sh --archive "$tmp/relocated/open-habitat-0.0.0-test-linux-amd64.tar.gz" --json >/dev/null 2>&1;then echo 'error: tampered relocated archive verified' >&2;exit 1;fi
phase final-checks
issuectl doctor --json
git diff --check
if $clean && [[ -n $(git status --short) ]];then git status --short >&2;echo 'error: green gate changed the clean tree' >&2;exit 1;fi
if $clean;then
  receipt_args=()
  if $reuse_phases;then receipt_args+=(--reused-phase browser --reused-phase go-and-contracts);fi
  python3 scripts/gate-receipt.py record "${receipt_args[@]}" >&2
fi
if $json;then
  reused_json='[]'
  if $reuse_phases;then reused_json='["browser","go-and-contracts"]';fi
  printf '{"schema_version":1,"data":{"status":"passed","clean":%s,"reused_phases":%s},"warnings":[]}\n' "$clean" "$reused_json"
else echo 'CI-local gate passed';fi
