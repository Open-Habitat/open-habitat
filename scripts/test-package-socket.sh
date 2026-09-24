#!/usr/bin/env bash
# Offline regression: re-signed unsafe packages must still fail verification.
set -euo pipefail
[[ $# -eq 1 && -f $1 ]] || { echo 'usage: test-package-socket.sh <release.tar.gz>' >&2; exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
archive=$(realpath "$1")
"$repo/scripts/verify-release.sh" --archive "$archive" --json >/dev/null
for mode in 0711 0755 duplicate; do
  mkdir -p "$tmp/$mode/stage"
  tar -xzf "$archive" -C "$tmp/$mode/stage"
  root=$(find "$tmp/$mode/stage" -mindepth 1 -maxdepth 1 -type d)
  if [[ $mode == duplicate ]]; then
    sed -i '/^DirectoryMode=0710$/a DirectoryMode=0711' "$root/systemd/native-agent-host-daemon@.socket"
  else
    sed -i "s/^DirectoryMode=0710$/DirectoryMode=$mode/" "$root/systemd/native-agent-host-daemon@.socket"
  fi
  (cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
  tar -czf "$tmp/$mode/unsafe.tar.gz" -C "$tmp/$mode/stage" "$(basename "$root")"
  (cd "$tmp/$mode"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
  if "$repo/scripts/verify-release.sh" --archive "$tmp/$mode/unsafe.tar.gz" --json >"$tmp/$mode/out" 2>"$tmp/$mode/err"; then
    echo "error: verifier accepted DirectoryMode=$mode" >&2; exit 1
  fi
  grep -q 'exactly one DirectoryMode=0710' "$tmp/$mode/err" || { cat "$tmp/$mode/err" >&2; exit 1; }
done
echo 'Package socket mode regression passed (re-signed world-searchable and duplicate-mode archives rejected)'
