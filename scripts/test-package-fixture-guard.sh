#!/usr/bin/env bash
# Both entrypoints must reject synthetic content, even with valid checksums.
set -euo pipefail
export TMPDIR=${TMPDIR:-/var/tmp}
[[ $# == 1 && -f $1 ]] || { echo 'usage: test-package-fixture-guard.sh <release.tar.gz>' >&2; exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
archive=$(realpath "$1")
# A refusal must be the one under test. The verifier's stderr goes to a file,
# so one that failed for another reason (a full disk, a missing tool) would
# otherwise end this script with no word of why.
refused_for(){ grep -q -- "$1" "$2" || { printf 'error: expected a refusal matching %s; the verifier said:\n' "$1" >&2; cat -- "$2" >&2; exit 1; }; }
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
"$repo/scripts/verify-release.sh" --archive "$archive" --json >/dev/null
mkdir "$work/web" "$work/stage" "$work/output"
printf 'Synthetic-lab-fixture\n' > "$work/web/index.html"
if "$repo/scripts/package-release.sh" --version 0.0.0-test --target linux-amd64 --web-dir "$work/web" --output "$work/output" >"$work/out" 2>"$work/err"; then
  echo 'packager accepted fixture token' >&2; exit 1
fi
refused_for 'test fixture content found' "$work/err"
tar --same-permissions -xzf "$archive" -C "$work/stage"
root=$(find "$work/stage" -mindepth 1 -maxdepth 1 -type d)
printf '\nSynthetic-lab-fixture\n' >> "$root/web/index.html"
(cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
tar -czf "$work/unsafe.tar.gz" -C "$work/stage" "$(basename "$root")"
(cd "$work"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
if "$repo/scripts/verify-release.sh" --archive "$work/unsafe.tar.gz" --json >"$work/out" 2>"$work/err"; then
  echo 'verifier accepted fixture token' >&2; exit 1
fi
refused_for 'test fixture content, control or source map' "$work/err"
# Source maps carry original source. Many of them, more than one pipe buffer
# of names, must be refused as surely as one.
rm -rf -- "$work/stage" && mkdir "$work/stage"
tar --same-permissions -xzf "$archive" -C "$work/stage"
root=$(find "$work/stage" -mindepth 1 -maxdepth 1 -type d)
mkdir "$root/web/maps" && chmod 0755 "$root/web/maps"
for i in $(seq 2000); do printf '{}' > "$root/web/maps/source-$i.js.map"; done
chmod 0644 "$root"/web/maps/*.map
(cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
tar -czf "$work/unsafe.tar.gz" -C "$work/stage" "$(basename "$root")"
(cd "$work"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
if "$repo/scripts/verify-release.sh" --archive "$work/unsafe.tar.gz" --json >"$work/out" 2>"$work/err"; then
  echo 'verifier accepted source maps' >&2; exit 1
fi
refused_for 'test fixture content, control or source map' "$work/err"
echo 'package and verify fixture-token and source-map refusals passed'
