#!/usr/bin/env bash
# Offline regression: re-signed unsafe packages must still fail verification.
set -euo pipefail
export TMPDIR=/var/tmp
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
# Even a re-signed archive must not hide a second effective systemd directive
# behind whitespace around '=' (accepted by systemd.syntax).
for mode in broker-listen broker-user; do
  mkdir -p "$tmp/$mode/stage"
  tar -xzf "$archive" -C "$tmp/$mode/stage"
  root=$(find "$tmp/$mode/stage" -mindepth 1 -maxdepth 1 -type d)
  if [[ $mode == broker-listen ]]; then
    sed -i '/^ListenStream=\/run\/native-agent-host\/broker.sock$/a ListenStream = 0.0.0.0:9999' "$root/systemd/native-agent-host-broker.socket"
  else
    sed -i '/^User=root$/a User = nobody' "$root/systemd/native-agent-host-broker.service"
  fi
  (cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
  tar -czf "$tmp/$mode/unsafe.tar.gz" -C "$tmp/$mode/stage" "$(basename "$root")"
  (cd "$tmp/$mode"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
  if "$repo/scripts/verify-release.sh" --archive "$tmp/$mode/unsafe.tar.gz" --json >"$tmp/$mode/out" 2>"$tmp/$mode/err"; then
    echo "error: verifier accepted $mode" >&2; exit 1
  fi
  grep -q 'differs or duplicates' "$tmp/$mode/err" || { cat "$tmp/$mode/err" >&2; exit 1; }
done
# Re-signed malicious inventories and continuation lines must also fail.
for mode in extra-file omitted-manifest broker-continuation broker-prestart broker-failure-action; do
  mkdir -p "$tmp/$mode/stage"
  tar -xzf "$archive" -C "$tmp/$mode/stage"
  root=$(find "$tmp/$mode/stage" -mindepth 1 -maxdepth 1 -type d)
  case $mode in
    extra-file) printf 'unlisted\n' > "$root/systemd/rogue.service" ;;
    omitted-manifest) sed -i '/systemd\/native-agent-host-broker.service$/d' "$root/MANIFEST.sha256" ;;
    broker-continuation) printf 'ExecStartPost=\\\n/bin/true\n' >> "$root/systemd/native-agent-host-broker.service" ;;
    broker-prestart) printf 'ExecStartPre=/bin/true\n' >> "$root/systemd/native-agent-host-broker.service" ;;
    broker-failure-action) sed -i '/^\[Unit\]$/a FailureAction=poweroff' "$root/systemd/native-agent-host-broker.service" ;;
  esac
  if [[ $mode != omitted-manifest ]]; then
    (cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
  fi
  tar -czf "$tmp/$mode/unsafe.tar.gz" -C "$tmp/$mode/stage" "$(basename "$root")"
  (cd "$tmp/$mode"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
  if "$repo/scripts/verify-release.sh" --archive "$tmp/$mode/unsafe.tar.gz" --json >"$tmp/$mode/out" 2>"$tmp/$mode/err"; then
    echo "error: verifier accepted $mode" >&2; exit 1
  fi
done
echo 'Package socket regression passed (re-signed unsafe units/inventories rejected)'
