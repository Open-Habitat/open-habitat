#!/usr/bin/env bash
set -euo pipefail
archive= json=false
while (($#));do case "$1" in --archive)archive=$2;shift 2;;--json)json=true;shift;;*)echo "error: unknown argument $1" >&2;exit 1;;esac;done
[[ -f $archive ]]||{ echo "error: archive '$archive' not found" >&2;exit 1;}; [[ -f $archive.sha256 ]]||{ echo "error: checksum '$archive.sha256' not found" >&2;exit 1;}
archive_dir=$(cd "$(dirname "$archive")"&&pwd); archive_name=$(basename "$archive"); checksum_file="$archive_dir/$archive_name.sha256"
[[ $(wc -l < "$checksum_file") -eq 1 ]]||{ echo 'error: checksum sidecar must contain exactly one entry' >&2;exit 1;}
read -r expected checksum_name extra < "$checksum_file"
[[ $expected =~ ^[0-9a-f]{64}$ && $checksum_name == "$archive_name" && -z ${extra:-} ]]||{ echo "error: checksum sidecar does not name '$archive_name' exactly" >&2;exit 1;}
printf '%s  %s\n' "$expected" "$archive_name" | (cd "$archive_dir";sha256sum -c - >/dev/null)
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT;tar -xzf "$archive" -C "$tmp";root=$(find "$tmp" -mindepth 1 -maxdepth 1 -type d);[[ -n $root ]]
for p in bin/native-agent-host web/index.html systemd/native-agent-host-gateway.service systemd/native-agent-host-daemon@.service systemd/native-agent-host-daemon@.socket sysusers.d/native-agent-host.conf tmpfiles.d/native-agent-host.conf MANIFEST.sha256 licenses/DEPENDENCIES.md;do [[ -f "$root/$p" ]]||{ echo "error: package missing $p" >&2;exit 1;};done
(cd "$root";sha256sum -c MANIFEST.sha256 >/dev/null)
# A valid checksum is not a security policy: reject world-searchable fallback
# directories even when a package has a matching, freshly generated manifest.
python3 - "$root/systemd/native-agent-host-daemon@.socket" <<'PY'
import pathlib, sys

unit = pathlib.Path(sys.argv[1]).read_text()
section = None
modes = []
for line in unit.splitlines():
    line = line.strip()
    if not line or line.startswith(('#', ';')):
        continue
    if line.startswith('[') and line.endswith(']'):
        section = line
    elif section == '[Socket]' and line.split('=', 1)[0].strip() == 'DirectoryMode':
        modes.append(line.split('=', 1)[1].strip() if '=' in line else '')
if modes != ['0710']:
    sys.exit('error: packaged daemon socket must have exactly one DirectoryMode=0710 in [Socket] (no world traversal)')
PY
if find "$root/web" -type f -name '*.map' | grep -q . || grep -R -E 'Alder-testifixture|Deterministinen testi: daemon|VITE_ENABLE_TEST_FIXTURES' "$root/web" >/dev/null;then echo 'error: test fixture content, control or source map in packaged web assets' >&2;exit 1;fi
version=$($root/bin/native-agent-host --json version);python3 -c 'import json,sys;x=json.load(sys.stdin);assert x["data"]["commit"] and len(x["data"]["commit"])==40'<<<"$version"
sha=$(sha256sum "$archive"|cut -d' ' -f1);if $json;then printf '{"schema_version":1,"data":{"status":"verified","archive":"%s","sha256":"%s"},"warnings":[]}\n' "$archive" "$sha";else echo "verified $archive $sha";fi
