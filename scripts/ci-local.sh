#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
clean=false;json=false;no_reuse=false
while (($#));do case "$1" in
--clean)clean=true;shift;;--json)json=true;shift;;--no-reuse)no_reuse=true;shift;;*)echo "error: unknown argument $1" >&2;exit 1;;esac;done
cd "$repo"
umask 077
# Diagnostic only: never kill another run's processes as part of a gate.
python3 scripts/browser-hosts.py --json >&2
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
export HOME="$tmp/home" GOCACHE="$repo/.cache/ci-local/go-build" GOMODCACHE="$repo/.cache/ci-local/go-mod" NPM_CONFIG_CACHE="$repo/.cache/ci-local/npm" PLAYWRIGHT_BROWSERS_PATH="$repo/.cache/ms-playwright"
export CI=1
# Bound concurrent native phases; respect caller/backend budgets.
export GOMAXPROCS="${GOMAXPROCS:-4}" OH_BROWSER_WORKERS="${OH_BROWSER_WORKERS:-4}" OH_WEB_WORKERS="${OH_WEB_WORKERS:-4}"
export NPM_CONFIG_CACHE="${npm_config_cache:-${NPM_CONFIG_CACHE:-$tmp/npm}}"
# Go's default module cache is read-only; worktree teardown must be able to remove it.
export GOFLAGS="${GOFLAGS:+$GOFLAGS }-modcacherw -p=4"
mkdir -p "$HOME" "$GOCACHE" "$GOMODCACHE" "$NPM_CONFIG_CACHE" "$PLAYWRIGHT_BROWSERS_PATH" "$tmp/bin"
heavy_failed=false
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
  # On an early web/setup failure, do not abandon the independent Go checks.
  if [[ -n ${go_pid-} ]]; then
    wait "$go_pid" || true
    cat "$tmp/go-and-contracts.log"
  fi
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
# Go fixture subprocesses also invoke python3 directly, not only $PYTHON.
export PATH="$tmp/venv/bin:$PATH"
go version
node --version
npm --version
issuectl --version | grep -Fx 'issuectl 0.19.0'
phase dependencies
go mod download
export GOPROXY=off
npm ci --prefix web --prefer-offline --no-audit --no-fund
# The mapped-UID Pi helper runs the pinned native SDK against a network-trapped synthetic provider.
npm ci --prefix internal/daemon/pi-device-test --ignore-scripts --prefer-offline --no-audit --no-fund
node --test internal/daemon/pi-device-test/*.test.mjs
npm exec --prefix web playwright install chromium
if ! $reuse_phases; then
  (
    start=$SECONDS
    trap 'echo "ci-local phase go-and-contracts: $((SECONDS-start))s"' EXIT
    step=$SECONDS
    npm run build-storybook --prefix web
    echo "ci-local phase storybook: $((SECONDS-step))s"
    step=$SECONDS
    go fmt ./...
    go vet ./...
    go test -race ./...
    echo "ci-local phase go-checks: $((SECONDS-step))s"
    go generate ./internal/contracts
    ./scripts/check-generated.sh
    "$PYTHON" scripts/validate-contracts.py
    "$PYTHON" scripts/validate-project-view.py
    "$PYTHON" scripts/check-licenses.py
    "$PYTHON" scripts/test-gate-receipt.py
    "$PYTHON" scripts/test-browser-hosts.py
    "$PYTHON" scripts/test-cloud-qualify.py
    ./scripts/vm-test.sh self-test --json
  ) >"$tmp/go-and-contracts.log" 2>&1 & go_pid=$!
fi
phase web-checks
npm run format:check --prefix web
npm run lint --prefix web
npm run typecheck --prefix web
npm test --prefix web
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
  # Same-UID browser hosts, editors and agents share the kernel inotify budget.
  # This snapshot is diagnostic only: /proc can hide FDs, and dup/fork can make
  # multiple descriptors refer to one instance. Never use it to waive a test.
  python3 - <<'PY' >&2 || printf 'ci-local resources: snapshot unavailable\n' >&2
import glob, os, resource
fds = inotify = 0
for proc in glob.glob('/proc/[0-9]*'):
    try:
        if os.stat(proc).st_uid != os.getuid():
            continue
        for fd in glob.glob(proc + '/fd/*'):
            try:
                target = os.readlink(fd)
            except OSError:
                continue
            fds += 1
            inotify += target == 'anon_inode:inotify'
    except OSError:
        continue
try:
    with open('/proc/sys/fs/inotify/max_user_instances') as f:
        limit = f.read().strip()
except OSError:
    limit = 'unavailable'
print(f'ci-local resources: inotify_max_user_instances={limit} visible_uid_inotify_fds={inotify} visible_uid_fds={fds} nofile={resource.getrlimit(resource.RLIMIT_NOFILE)} loadavg={os.getloadavg()}')
PY
  (
    start=$SECONDS
    trap 'echo "ci-local phase browser: $((SECONDS-start))s"' EXIT
    ordinary_rc=0; lab_rc=0
    (cd web && OH_WEB_PREBUILT=1 npx playwright test) || ordinary_rc=$?
    (cd web && OH_WEB_PREBUILT=1 npx playwright test --config playwright.lab.config.ts) || lab_rc=$?
    echo "ci-local browser exits: ordinary=$ordinary_rc lab=$lab_rc"
    ((ordinary_rc == 0 && lab_rc == 0))
  ) >"$tmp/browser.log" 2>&1 & browser_pid=$!
  browser_rc=0; go_rc=0
  wait "$browser_pid" || browser_rc=$?
  wait "$go_pid" || go_rc=$?
  unset go_pid
  cat "$tmp/browser.log" "$tmp/go-and-contracts.log"
  if ((browser_rc || go_rc));then
    echo "error: browser exit=$browser_rc; Go/contracts exit=$go_rc" >&2
    heavy_failed=true
  fi
else
  echo 'ci-local phase browser and go-and-contracts: reused from passed receipt for identical committed tree' >&2
fi
phase native-fixture
./scripts/native-fixture.sh create --output "$tmp/native-fixture"
test "$(wc -l < "$tmp/native-fixture/home/.pi/agent/sessions/fixture.jsonl")" -eq 2500
phase packaging
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
# The arm64 package is cross-built from the same tree and must be as reproducible.
mkdir -p dist/arm64-one dist/arm64-two
./scripts/package-release.sh --version 0.0.0-test --target linux-arm64 --web-dir web/dist --output dist/arm64-one
./scripts/package-release.sh --version 0.0.0-test --target linux-arm64 --web-dir web/dist --output dist/arm64-two
cmp dist/arm64-one/open-habitat-0.0.0-test-linux-arm64.tar.gz dist/arm64-two/open-habitat-0.0.0-test-linux-arm64.tar.gz
bash scripts/test-package-socket.sh dist/arm64-one/open-habitat-0.0.0-test-linux-arm64.tar.gz
phase final-checks
issuectl doctor --json
git diff --check
if $clean && [[ -n $(git status --short) ]];then git status --short >&2;echo 'error: green gate changed the clean tree' >&2;exit 1;fi
if $heavy_failed;then echo 'error: gate failed; no receipt written' >&2;exit 1;fi
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
