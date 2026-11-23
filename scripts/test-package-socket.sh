#!/usr/bin/env bash
# Offline regression: re-signed unsafe packages must still fail verification.
set -euo pipefail
export TMPDIR=${TMPDIR:-/var/tmp}
[[ $# -eq 1 && -f $1 ]] || { echo 'usage: test-package-socket.sh <release.tar.gz>' >&2; exit 1; }
repo=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
archive=$(realpath "$1")
# A refusal must be the one under test. The verifier's stderr goes to a file,
# so one that failed for another reason (a full disk, a missing tool) would
# otherwise end this script with no word of why.
refused_for(){ grep -q -- "$1" "$2" || { printf 'error: expected a refusal matching %s; the verifier said:\n' "$1" >&2; cat -- "$2" >&2; exit 1; }; }
"$repo/scripts/verify-release.sh" --archive "$archive" --json >/dev/null
for mode in 0711 0755 duplicate; do
  mkdir -p "$tmp/$mode/stage"
  tar --same-permissions -xzf "$archive" -C "$tmp/$mode/stage"
  root=$(find "$tmp/$mode/stage" -mindepth 1 -maxdepth 1 -type d)
  if [[ $mode == duplicate ]]; then
    sed -i '/^DirectoryMode=0710$/a DirectoryMode=0711' "$root/systemd/open-habitat-daemon@.socket"
  else
    sed -i "s/^DirectoryMode=0710$/DirectoryMode=$mode/" "$root/systemd/open-habitat-daemon@.socket"
  fi
  (cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
  tar -czf "$tmp/$mode/unsafe.tar.gz" -C "$tmp/$mode/stage" "$(basename "$root")"
  (cd "$tmp/$mode"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
  if "$repo/scripts/verify-release.sh" --archive "$tmp/$mode/unsafe.tar.gz" --json >"$tmp/$mode/out" 2>"$tmp/$mode/err"; then
    echo "error: verifier accepted DirectoryMode=$mode" >&2; exit 1
  fi
  refused_for 'exactly one DirectoryMode=0710' "$tmp/$mode/err"
done
# Even a re-signed archive must not hide a second effective systemd directive
# behind whitespace around '=' (accepted by systemd.syntax).
for mode in broker-listen broker-user broker-paths-missing broker-paths-extra broker-paths-reset broker-paths-duplicate broker-paths-reversed broker-paths-required broker-tmp-private broker-tmp-duplicate; do
  mkdir -p "$tmp/$mode/stage"
  tar --same-permissions -xzf "$archive" -C "$tmp/$mode/stage"
  root=$(find "$tmp/$mode/stage" -mindepth 1 -maxdepth 1 -type d)
  service="$root/systemd/open-habitat-broker.service"
  case $mode in
    broker-listen) sed -i '/^ListenStream=\/run\/open-habitat\/broker.sock$/a ListenStream = 0.0.0.0:9999' "$root/systemd/open-habitat-broker.socket" ;;
    broker-user) sed -i '/^User=root$/a User = nobody' "$service" ;;
    broker-paths-missing) sed -i '\@^ReadWritePaths=/tmp @d' "$service" ;;
    broker-paths-extra) sed -i '\@^ReadWritePaths=/tmp @s@$@ /srv@' "$service" ;;
    broker-paths-reset) sed -i '/^ReadWritePaths=/a ReadWritePaths =' "$service" ;;
    broker-paths-duplicate) sed -i '/^ReadWritePaths=/p' "$service" ;;
    broker-paths-reversed)
      python3 - "$service" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
lines = p.read_text().splitlines()
indices = [i for i, line in enumerate(lines) if line.startswith('ReadWritePaths=')]
assert len(indices) == 2
lines[indices[0]], lines[indices[1]] = lines[indices[1]], lines[indices[0]]
p.write_text('\n'.join(lines) + '\n')
PY
      ;;
    broker-paths-required) sed -i 's@-/var/mail@/var/mail@' "$service" ;;
    broker-tmp-private) sed -i 's/^PrivateTmp=no$/PrivateTmp=yes/' "$service" ;;
    broker-tmp-duplicate) sed -i '/^PrivateTmp=no$/a PrivateTmp = no' "$service" ;;
  esac
  (cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
  tar -czf "$tmp/$mode/unsafe.tar.gz" -C "$tmp/$mode/stage" "$(basename "$root")"
  (cd "$tmp/$mode"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
  if "$repo/scripts/verify-release.sh" --archive "$tmp/$mode/unsafe.tar.gz" --json >"$tmp/$mode/out" 2>"$tmp/$mode/err"; then
    echo "error: verifier accepted $mode" >&2; exit 1
  fi
  refused_for 'differs or duplicates' "$tmp/$mode/err"
done
# Noncanonical whitespace and line separators must not be normalized away by
# Python while the unit manager reads different effective directives.
for mode in broker-nbsp broker-nul; do
  mkdir -p "$tmp/$mode/stage"
  tar --same-permissions -xzf "$archive" -C "$tmp/$mode/stage"
  root=$(find "$tmp/$mode/stage" -mindepth 1 -maxdepth 1 -type d)
  python3 - "$root/systemd/open-habitat-broker.service" "$mode" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
data = p.read_bytes()
old, new = ((b'ProtectSystem=strict\n', b'ProtectSystem=strict\xc2\xa0\n')
            if sys.argv[2] == 'broker-nbsp' else
            (b'UMask=0077\n', b'# note\x00ExecStartPre=/bin/true\nUMask=0077\n'))
assert data.count(old) == 1
p.write_bytes(data.replace(old, new))
PY
  (cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256)
  tar -czf "$tmp/$mode/unsafe.tar.gz" -C "$tmp/$mode/stage" "$(basename "$root")"
  (cd "$tmp/$mode"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
  if "$repo/scripts/verify-release.sh" --archive "$tmp/$mode/unsafe.tar.gz" --json >"$tmp/$mode/out" 2>"$tmp/$mode/err"; then
    echo "error: verifier accepted $mode" >&2; exit 1
  fi
  refused_for 'packaged template contains noncanonical bytes' "$tmp/$mode/err"
done
# Re-signed malicious inventories and continuation lines must also fail.
for mode in storage-rate-limited binding-rate-limited binding-default-deps binding-cached binding-skipped binding-unordered storage-cached storage-skipped storage-private storage-unguarded extra-file omitted-manifest broker-continuation broker-prestart broker-failure-action proc-visible proc-private proc-exempt proc-members proc-unordered agent-mode agent-route agent-unordered guest-mode guest-group guest-route guest-unordered tmp-shared tmp-public tmp-unaged; do
  mkdir -p "$tmp/$mode/stage"
  tar --same-permissions -xzf "$archive" -C "$tmp/$mode/stage"
  root=$(find "$tmp/$mode/stage" -mindepth 1 -maxdepth 1 -type d)
  case $mode in
    storage-rate-limited) sed -i '/^StartLimitIntervalSec=0$/d' "$root/systemd/open-habitat-storage.service" ;;
    binding-rate-limited) sed -i '/^StartLimitIntervalSec=0$/d' "$root/systemd/open-habitat-binding@.service" ;;
    binding-default-deps) sed -i '/DefaultDependencies=no/d' "$root/systemd/open-habitat-binding@.service" ;;
    binding-cached) sed -i 's/RemainAfterExit=no/RemainAfterExit=yes/' "$root/systemd/open-habitat-binding@.service" ;;
    binding-skipped) sed -i 's@ExecStart=.*@ExecStart=/usr/bin/true@' "$root/systemd/open-habitat-binding@.service" ;;
    binding-unordered) sed -i 's/ open-habitat-binding@%i.service//' "$root/systemd/open-habitat-daemon@.socket" ;;
    storage-cached) printf 'RemainAfterExit=yes\n' >> "$root/systemd/open-habitat-storage.service" ;;
    storage-skipped) sed -i 's@ExecStart=.*@ExecStart=/bin/true@' "$root/systemd/open-habitat-storage.service" ;;
    storage-private) printf 'PrivateMounts=yes\n' >> "$root/systemd/open-habitat-storage.service" ;;
    storage-unguarded) sed -i 's/Requires=open-habitat-storage.service /Requires=/' "$root/systemd/open-habitat-agent@.socket" ;;
    agent-mode) sed -i 's/SocketMode=0600/SocketMode=0666/' "$root/systemd/open-habitat-agent@.socket" ;;
    agent-route) sed -i 's/Service=open-habitat-daemon@%i.service/Service=other@%i.service/' "$root/systemd/open-habitat-agent@.socket" ;;
    agent-unordered) sed -i 's/ open-habitat-agent@%i.socket//' "$root/systemd/open-habitat-daemon@.service" ;;
    guest-mode) sed -i 's/SocketMode=0660/SocketMode=0666/' "$root/systemd/open-habitat-guest@.socket" ;;
    guest-group) sed -i 's/SocketGroup=open-habitat-gateway/SocketGroup=users/' "$root/systemd/open-habitat-guest@.socket" ;;
    guest-route) sed -i 's/Service=open-habitat-daemon@%i.service/Service=other@%i.service/' "$root/systemd/open-habitat-guest@.socket" ;;
    guest-unordered) sed -i 's/ open-habitat-guest@%i.socket//' "$root/systemd/open-habitat-daemon@.service" ;;
    tmp-shared) sed -i '/^BindPaths=/d' "$root/systemd/open-habitat-daemon@.service" ;;
    tmp-public) sed -i 's/^StateDirectoryMode=0700$/StateDirectoryMode=0755/' "$root/systemd/open-habitat-daemon@.service" ;;
    tmp-unaged) sed -i '/open-habitat-tmp/d' "$root/tmpfiles.d/open-habitat.conf" ;;
    proc-visible) sed -i 's/hidepid=invisible/hidepid=0/' "$root/systemd/open-habitat-proc.service" ;;
    proc-private) printf 'PrivateMounts=yes\n' >> "$root/systemd/open-habitat-proc.service" ;;
    proc-exempt) sed -i 's/SupplementaryGroups=open-habitat-proc/SupplementaryGroups=open-habitat-gateway/' "$root/systemd/polkit.service.d/open-habitat-proc.conf" ;;
    proc-members) printf 'm open-habitat-gateway open-habitat-proc\n' >> "$root/sysusers.d/open-habitat.conf" ;;
    proc-unordered) sed -i 's/Requires=open-habitat-proc.service /Requires=/' "$root/systemd/open-habitat-daemon@.service" ;;
    extra-file) printf 'unlisted\n' > "$root/systemd/rogue.service" ;;
    omitted-manifest) sed -i '/systemd\/open-habitat-broker.service$/d' "$root/MANIFEST.sha256" ;;
    broker-continuation) printf 'ExecStartPost=\\\n/bin/true\n' >> "$root/systemd/open-habitat-broker.service" ;;
    broker-prestart) printf 'ExecStartPre=/bin/true\n' >> "$root/systemd/open-habitat-broker.service" ;;
    broker-failure-action) sed -i '/^\[Unit\]$/a FailureAction=poweroff' "$root/systemd/open-habitat-broker.service" ;;
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
# Every shipped executable needs canonical public execute modes.
for executable in open-habitat runtime-release open-habitat-mcp-relay; do
  stage="$tmp/private-$executable/stage"
  mkdir -p "$stage"
  tar --same-permissions -xzf "$archive" -C "$stage"
  root=$(find "$stage" -mindepth 1 -maxdepth 1 -type d)
  chmod 0700 "$root/bin/$executable"
  unsafe="$tmp/private-$executable/unsafe.tar.gz"
  tar -czf "$unsafe" -C "$stage" "$(basename "$root")"
  (cd "$(dirname "$unsafe")"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
  if "$repo/scripts/verify-release.sh" --archive "$unsafe" --json >"$tmp/private-$executable/out" 2>"$tmp/private-$executable/err"; then
    echo "error: verifier accepted a private $executable mode" >&2; exit 1
  fi
  refused_for 'noncanonical permissions' "$tmp/private-$executable/err"
done
# A relay omitted, modified without its manifest hash, or for another target
# must be refused even when the outer archive checksum was recomputed.
for mode in relay-missing relay-corrupt relay-arch; do
  stage="$tmp/$mode/stage"
  mkdir -p "$stage"
  tar --same-permissions -xzf "$archive" -C "$stage"
  root=$(find "$stage" -mindepth 1 -maxdepth 1 -type d)
  case $mode in
    relay-missing) rm "$root/bin/open-habitat-mcp-relay" ;;
    relay-corrupt) printf 'changed' >> "$root/bin/open-habitat-mcp-relay" ;;
    relay-arch)
      python3 - "$root/bin/open-habitat-mcp-relay" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
b = bytearray(p.read_bytes())
b[18:20] = (183 if int.from_bytes(b[18:20], 'little') == 62 else 62).to_bytes(2, 'little')
p.write_bytes(b)
PY
      (cd "$root"; find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 sha256sum > MANIFEST.sha256) ;;
  esac
  unsafe="$tmp/$mode/unsafe.tar.gz"
  tar -czf "$unsafe" -C "$stage" "$(basename "$root")"
  (cd "$(dirname "$unsafe")"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
  if "$repo/scripts/verify-release.sh" --archive "$unsafe" --json >"$tmp/$mode/out" 2>"$tmp/$mode/err"; then
    echo "error: verifier accepted $mode" >&2; exit 1
  fi
  case $mode in
    relay-missing) refused_for 'package missing bin/open-habitat-mcp-relay' "$tmp/$mode/err" ;;
    relay-corrupt) refused_for 'package checksum mismatch: bin/open-habitat-mcp-relay' "$tmp/$mode/err" ;;
    relay-arch) refused_for 'bin/open-habitat-mcp-relay is not a 64-bit little-endian' "$tmp/$mode/err" ;;
  esac
done
# A re-signed package renamed to the other architecture must not pass as one.
stage="$tmp/foreign-arch/stage"
mkdir -p "$stage"
tar --same-permissions -xzf "$archive" -C "$stage"
root=$(find "$stage" -mindepth 1 -maxdepth 1 -type d)
case $root in *-linux-amd64) other=${root%-linux-amd64}-linux-arm64;; *-linux-arm64) other=${root%-linux-arm64}-linux-amd64;; *) echo 'error: unexpected package target' >&2; exit 1;; esac
mv "$root" "$other"
unsafe="$tmp/foreign-arch/unsafe.tar.gz"
tar --owner=0 --group=0 --numeric-owner -czf "$unsafe" -C "$stage" "$(basename "$other")"
(cd "$(dirname "$unsafe")"; sha256sum unsafe.tar.gz > unsafe.tar.gz.sha256)
if "$repo/scripts/verify-release.sh" --archive "$unsafe" --json >"$tmp/foreign-arch/out" 2>"$tmp/foreign-arch/err"; then
  echo "error: verifier accepted executables of another architecture" >&2; exit 1
fi
refused_for 'is not a 64-bit little-endian' "$tmp/foreign-arch/err"
