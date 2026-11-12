#!/usr/bin/env bash
# Periodic detector, deliberately outside ci-local. Optional grep selects a smoke subset.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ${1:-} != --locked ]]; then
  exec python3 scripts/browser-suite-lock.py --label "$PWD stress" -- bash "$0" --locked "$@"
fi
shift
umask 077
# Browser hosts and Chromium profiles get a private disk-backed TMPDIR that
# leaves with this run; scratch.sh says where.
source scripts/scratch.sh
oh_scratch_dir run_tmp ohs
trap 'rm -rf "$run_tmp"' EXIT
export TMPDIR=$run_tmp
export OH_CPU_THROTTLE=4 OH_REPLY_DELAY_MS=250 OH_TIMEOUT_SCALE=4
export OH_REPLY_SEED="${OH_REPLY_SEED:-$(date +%s%N)}"
export OH_BROWSER_WORKERS="${OH_BROWSER_WORKERS:-2}"
base="${OH_PORT_BASE:-11000}"
echo "Stress replay: OH_REPLY_SEED=$OH_REPLY_SEED OH_PORT_BASE=$base"
args=(--repeat-each 2 --trace off)
if [[ $# -gt 0 ]]; then args+=(--grep "$1"); fi
cd web
status=0
OH_PORT_BASE="$base" npx playwright test "${args[@]}" || status=1
OH_PORT_BASE="$((base + 100))" npx playwright test --config playwright.lab.config.ts "${args[@]}" || status=1
exit "$status"
