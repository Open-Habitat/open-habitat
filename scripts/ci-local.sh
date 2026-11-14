#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
clean=false;json=false;no_reuse=false
while (($#));do case "$1" in
--clean)clean=true;shift;;--json)json=true;shift;;--no-reuse)no_reuse=true;shift;;*)echo "error: unknown argument $1" >&2;exit 1;;esac;done
cd "$repo"
umask 077
# `git bisect run` and hooks export GIT_DIR; a fixture's `git init` inheriting
# it rewrites this repository (bare, from a linked worktree), not its scratch.
unset $(git rev-parse --local-env-vars)
# Every checkout and worker shares the common config; a test that rewrites its
# core section breaks all of them, so the gate fails on any change. Branch and
# worktree entries are left out: parallel workers add them legitimately.
shared_config="$(git rev-parse --path-format=absolute --git-common-dir)/config"
shared_core(){ git config --file "$shared_config" --get-regexp '^core\.' || true; }
shared_core_before=$(shared_core)
shared_core_reported=false
shared_core_unchanged(){
  local now
  now=$(shared_core)
  [[ $now == "$shared_core_before" ]] && return 0
  if ! $shared_core_reported;then
    printf 'error: the gate changed the shared repository config %s\nbefore:\n%s\nafter:\n%s\n' "$shared_config" "$shared_core_before" "$now" >&2
    shared_core_reported=true
  fi
  return 1
}
# Diagnostic only: never kill another run's processes as part of a gate.
python3 scripts/browser-hosts.py --json >&2
if $clean && [[ -n $(git status --short) ]];then echo 'error: --clean requires a clean tree at entry' >&2;exit 1;fi
# A prior complete gate on the identical committed tree is local evidence for
# unchanged phase inputs. The full tree is the conservative input hash: no
# narrower list can safely omit fixtures, scripts or package metadata.
reuse_phases=false
if $clean && ! $no_reuse && python3 scripts/gate-receipt.py check >/dev/null 2>&1;then reuse_phases=true;fi
# Build caches, npm installs and test children must not exhaust the /tmp tmpfs.
# Test children's TMPDIR is this run's own directory, so whatever a killed child
# leaves behind goes with it. Go tests need it short; scratch.sh says where.
source "$repo/scripts/scratch.sh"
oh_short_scratch_dir tmp ohc
trap 'rm -rf "$tmp"' EXIT
export TMPDIR=$tmp
# Content-addressed build/download caches are disposable, but survive consecutive
# runs in this checkout. HOME and the Python/tool installs remain private per run.
export HOME="$tmp/home" GOCACHE="$repo/.cache/ci-local/go-build" GOMODCACHE="$repo/.cache/ci-local/go-mod" NPM_CONFIG_CACHE="$repo/.cache/ci-local/npm" PLAYWRIGHT_BROWSERS_PATH="$repo/.cache/ms-playwright"
export CI=1
# Bound concurrent native phases; respect caller/backend budgets.
# The browser suites run side by side, ordinary with OH_BROWSER_WORKERS and lab
# with OH_LAB_WORKERS; 6 + 3 kept an 8-core test host just short of saturation, where
# timing-sensitive cases start to fail.
export GOMAXPROCS="${GOMAXPROCS:-4}" OH_BROWSER_WORKERS="${OH_BROWSER_WORKERS:-6}" OH_LAB_WORKERS="${OH_LAB_WORKERS:-3}" OH_WEB_WORKERS="${OH_WEB_WORKERS:-4}" tmp
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
  if [[ -n ${packaging_pid-} ]]; then
    wait "$packaging_pid" || true
    cat "$tmp/packaging.log"
  fi
  chmod -R u+w "$tmp" 2>/dev/null || true
  rm -rf "$tmp"
  shared_core_unchanged || exit 1
}
trap cleanup EXIT
# Every non-system tool is fetched into disposable storage and checksum/version checked.
# CI requires the pinned issuectl even when a newer machine CLI is present.
# Never install into a persistent machine path.
# The gate runs on either supported architecture.
case $(uname -m) in
x86_64)issue_triple=x86_64-unknown-linux-musl issue_sha=8c4f24749ff6a688193fc92a329df12e8f4ba2d48290b8d15d06a9509b551828;;
aarch64)issue_triple=aarch64-unknown-linux-musl issue_sha=a66b2c4f2707f30fe35f1c19de3e570eef34d7013715ec0892933c70ee0c21ac;;
*)echo "error: unsupported gate host architecture $(uname -m)" >&2;exit 1;;esac
# The archive is kept by its checksum and verified on every use.
issue_archive="$repo/.cache/ci-local/issuectl-$issue_sha.tar.xz"
if ! echo "$issue_sha  $issue_archive" | sha256sum -c - >/dev/null 2>&1;then
  curl -fsSL --retry 3 --retry-all-errors "https://github.com/jarimustonen/issuectl/releases/download/v0.21.0/issuectl-$issue_triple.tar.xz" -o "$tmp/issuectl.tar.xz"
  mv "$tmp/issuectl.tar.xz" "$issue_archive"
fi
echo "$issue_sha  $issue_archive" | sha256sum -c -
tar -xJf "$issue_archive" -C "$tmp"
cp "$tmp/issuectl-$issue_triple/issuectl" "$tmp/bin/issuectl"
export PATH="$tmp/bin:$PATH"
source "$repo/scripts/ci-python.sh"
oh_ci_venv "$tmp/venv"
export PYTHON="$tmp/venv/bin/python"
# Go fixture subprocesses also invoke python3 directly, not only $PYTHON.
export PATH="$tmp/venv/bin:$PATH"
go version
node --version
npm --version
issuectl --version | grep -Fx 'issuectl 0.21.0'
phase dependencies
go mod download
export GOPROXY=off
npm ci --prefix web --prefer-offline --no-audit --no-fund
# The mapped-UID Pi helper runs the pinned native SDK against a network-trapped synthetic provider.
npm ci --prefix internal/daemon/pi-device-test --ignore-scripts --prefer-offline --no-audit --no-fund
# The page-reader device test launches the headless shell from this gate's cache.
npm exec --prefix web playwright install chromium chromium-headless-shell
node --test internal/daemon/pi-device-test/*.test.mjs
if ! $reuse_phases; then
  # The rewriting steps run before anything reads the tree beside them: the
  # web checks, the build and packaging read these sources, and contractgen
  # truncates its outputs on every run.
  go fmt ./...
  go generate ./internal/contracts
  ./scripts/check-generated.sh
  (
    start=$SECONDS
    trap 'echo "ci-local phase go-and-contracts: $((SECONDS-start))s"' EXIT
    step=$SECONDS
    npm run build-storybook --prefix web
    echo "ci-local phase storybook: $((SECONDS-step))s"
    step=$SECONDS
    go vet ./...
    go test -race ./...
    # Built without the race detector only: 40 MiB of JSON is too slow under it.
    go test ./internal/daemon -run '^TestLargeSession'
    echo "ci-local phase go-checks: $((SECONDS-step))s"
    "$PYTHON" scripts/test-ui-reference.py
    "$PYTHON" scripts/validate-contracts.py
    "$PYTHON" scripts/validate-project-view.py
    "$PYTHON" scripts/test-project-scripts.py
    "$PYTHON" scripts/check-licenses.py
    "$PYTHON" scripts/test-gate-receipt.py
    "$PYTHON" scripts/test-browser-hosts.py
    "$PYTHON" scripts/test-test-focused.py
    "$PYTHON" scripts/test-cloud-qualify.py
    "$PYTHON" scripts/test-profile-runtime-build.py
    "$PYTHON" scripts/test-prepare-release.py
    "$PYTHON" scripts/test-prepare-release-closure.py
    "$PYTHON" scripts/test-screenshots-to-avif.py
    ./scripts/vm-test.sh self-test --json
  ) >"$tmp/go-and-contracts.log" 2>&1 & go_pid=$!
fi
phase web-checks
npm run check --prefix web
npm run typecheck --prefix web
npm test --prefix web
# Build once before Playwright: the same fresh production assets are served by
# the synthetic host and later packaged. Standalone Playwright still builds.
npm run build --prefix web
if grep -R -E 'Synthetic-lab-fixture|Deterministinen testi: daemon' web/dist/assets;then
  echo 'error: test fixture content leaked into production bundle' >&2;exit 1
fi
# Packaging reads only the built web assets and the committed Go sources, and
# its checks are about a minute and a half of one or two cores: it runs beside
# the browser and Go phase, which leaves a part of the machine idle.
(
  set -e
  step=$SECONDS
  ./scripts/native-fixture.sh create --output "$tmp/native-fixture"
  test "$(wc -l < "$tmp/native-fixture/home/.pi/agent/sessions/fixture.jsonl")" -eq 2500
  echo "ci-local phase native-fixture: $((SECONDS-step))s"; step=$SECONDS
  rm -rf dist;mkdir -p dist/one dist/two
  ./scripts/package-release.sh --version 0.0.0-test --target linux-amd64 --web-dir web/dist --output dist/one
  ./scripts/package-release.sh --version 0.0.0-test --target linux-amd64 --web-dir web/dist --output dist/two
  cmp dist/one/open-habitat-0.0.0-test-linux-amd64.tar.gz dist/two/open-habitat-0.0.0-test-linux-amd64.tar.gz
  ./scripts/verify-release.sh --archive dist/one/open-habitat-0.0.0-test-linux-amd64.tar.gz --json
  bash scripts/test-package-socket.sh dist/one/open-habitat-0.0.0-test-linux-amd64.tar.gz
  bash scripts/test-package-fixture-guard.sh dist/one/open-habitat-0.0.0-test-linux-amd64.tar.gz
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
  echo "ci-local phase packaging: $((SECONDS-step))s"
) >"$tmp/packaging.log" 2>&1 & packaging_pid=$!
# Browser and Go/contracts read the same built assets but write separate outputs.
# Keep separate logs so failures in either child are reported even when both fail.
phase browser-go-contracts-and-packaging
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
    # Both suites run under one hold of the host-wide whole-suite lock. Its
    # waiting message goes to the gate's stderr (fd 9), not the buffered log.
    # The ordinary and lab suites run side by side: each is a few minutes of
    # mostly Chromium CPU, and one after the other left cores idle. The lab
    # suite listens 100 ports up, since ordinary specs start lab-mode hosts
    # too, and writes test-results-lab. The host binary is built once here,
    # not under the other suite's running hosts. Traces are off: recording
    # every case cost about a quarter of the suite's CPU; rerun a failed spec
    # with --trace on (TESTING.md). The suites run at a lower priority than
    # the Go tests beside them: those mostly wait on subprocesses and use under
    # a core (249 s alone), but starved behind the browsers took 596 s.
    go build -o .cache/browser-host ./test/browser-host
    nice -n 5 python3 scripts/browser-suite-lock.py --label "$repo (ci-local)" --status-fd 9 -- bash -c '
      export OH_WEB_PREBUILT=1 OH_BROWSER_HOST_PREBUILT=1
      suite(){
        local name=$1 start=$SECONDS rc=0; shift
        (cd web && "$@") >"$tmp/browser-$name.log" 2>&1 || rc=$?
        echo "ci-local phase browser-$name: $((SECONDS-start))s (exit $rc)" >>"$tmp/browser-$name.log"
        return "$rc"
      }
      suite ordinary npx playwright test --trace off & ordinary=$!
      OH_PORT_BASE=$((${OH_PORT_BASE:-4174} + 100)) OH_BROWSER_WORKERS=$OH_LAB_WORKERS \
        suite lab npx playwright test --config playwright.lab.config.ts --trace off & lab=$!
      ordinary_rc=0; lab_rc=0
      wait "$ordinary" || ordinary_rc=$?
      wait "$lab" || lab_rc=$?
      cat "$tmp/browser-ordinary.log" "$tmp/browser-lab.log"
      echo "ci-local browser exits: ordinary=$ordinary_rc lab=$lab_rc"
      ((ordinary_rc == 0 && lab_rc == 0))'
  ) 9>&2 >"$tmp/browser.log" 2>&1 & browser_pid=$!
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
packaging_rc=0
wait "$packaging_pid" || packaging_rc=$?
unset packaging_pid
cat "$tmp/packaging.log"
if ((packaging_rc));then echo "error: packaging exit=$packaging_rc" >&2;exit 1;fi
phase final-checks
issuectl doctor --json
git diff --check
if $clean && [[ -n $(git status --short) ]];then git status --short >&2;echo 'error: green gate changed the clean tree' >&2;exit 1;fi
if $heavy_failed;then echo 'error: gate failed; no receipt written' >&2;exit 1;fi
shared_core_unchanged || exit 1
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
