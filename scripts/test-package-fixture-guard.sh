#!/usr/bin/env bash
# Both entrypoints must reject synthetic content, even with valid checksums.
set -euo pipefail
export TMPDIR=/var/tmp
[[ $# == 1 && -f $1 ]] || { echo 'usage: test-package-fixture-guard.sh <release.tar.gz>' >&2; exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
archive=$(realpath "$1")
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
"$repo/scripts/verify-release.sh" --archive "$archive" --json >/dev/null
mkdir "$work/web" "$work/stage" "$work/output"
printf 'Synthetic-lab-fixture\n' > "$work/web/index.html"
if "$repo/scripts/package-release.sh" --version 0.0.0-test --target linux-amd64 --web-dir "$work/web" --output "$work/output" >"$work/out" 2>"$work/err"; then
  echo 'packager accepted fixture token' >&2; exit 1
fi
grep -q 'test fixture content found' "$work/err"
tar --same-permissions -xzf "$archive" -C "$work/stage"
root=$(find "$work/stage" -mindepth 1 -maxdepth 1 -type d)
printf '\nSynthetic-lab-fixture\n' >> "$root/web/index.html"
(cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
tar -czf "$work/unsafe.tar.gz" -C "$work/stage" "$(basename "$root")"
(cd "$work"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
if "$repo/scripts/verify-release.sh" --archive "$work/unsafe.tar.gz" --json >"$work/out" 2>"$work/err"; then
  echo 'verifier accepted fixture token' >&2; exit 1
fi
grep -q 'test fixture content, control or source map' "$work/err"
echo 'package and verify fixture-token refusals passed'
