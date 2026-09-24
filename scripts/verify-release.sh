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
tmp=$(mktemp -d);trap 'rm -rf "$tmp"' EXIT
# Validate the archive before extraction: tar's default extraction accepts links
# and traversal, while the manifest alone does not constrain its inventory.
python3 - "$archive" "$tmp" <<'PY'
import pathlib, sys, tarfile
archive, dest = sys.argv[1:]
with tarfile.open(archive, 'r:gz') as tar:
    members = tar.getmembers()
    roots = {m.name.split('/')[0] for m in members}
    if len(roots) != 1 or not members:
        sys.exit('error: archive must contain one release root')
    root = next(iter(roots))
    seen = set()
    for m in members:
        p = pathlib.PurePosixPath(m.name)
        if (m.name in seen or m.name.startswith('/') or not p.parts or
            '..' in p.parts or '.' in p.parts or p.parts[0] != root or
            not (m.isfile() or m.isdir())):
            sys.exit('error: unsafe or duplicate archive entry')
        seen.add(m.name)
    tar.extractall(dest, filter='data')
PY
root=$(find "$tmp" -mindepth 1 -maxdepth 1 -type d);[[ -n $root ]]
for p in bin/native-agent-host web/index.html systemd/native-agent-host-gateway.service systemd/native-agent-host-broker.service systemd/native-agent-host-broker.socket systemd/native-agent-host-daemon@.service systemd/native-agent-host-daemon@.socket sysusers.d/native-agent-host.conf tmpfiles.d/native-agent-host.conf MANIFEST.sha256 licenses/DEPENDENCIES.md;do [[ -f "$root/$p" ]]||{ echo "error: package missing $p" >&2;exit 1;};done
python3 - "$root" <<'PY'
import hashlib, pathlib, re, sys
root = pathlib.Path(sys.argv[1])
manifest = root / 'MANIFEST.sha256'
actual = {str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
expected = {}
for line in manifest.read_text().splitlines():
    match = re.fullmatch(r'([0-9a-f]{64})  \./(.+)', line)
    if not match:
        sys.exit('error: malformed manifest entry')
    digest, name = match.groups()
    parts = pathlib.PurePosixPath(name)
    if name in expected or name == 'MANIFEST.sha256' or '..' in parts.parts or not (root / name).is_file():
        sys.exit('error: unsafe or duplicate manifest entry')
    expected[name] = digest
if actual != set(expected) | {'MANIFEST.sha256'}:
    sys.exit('error: package inventory differs from manifest')
allowed = {'bin/native-agent-host', 'MANIFEST.sha256', 'licenses/DEPENDENCIES.md',
           'systemd/native-agent-host-gateway.service',
           'systemd/native-agent-host-daemon@.service', 'systemd/native-agent-host-daemon@.socket',
           'systemd/native-agent-host-broker.service', 'systemd/native-agent-host-broker.socket',
           'sysusers.d/native-agent-host.conf', 'tmpfiles.d/native-agent-host.conf'}
if any(not (name in allowed or name.startswith('web/')) for name in actual):
    sys.exit('error: package contains unreviewed files outside web assets')
for name, digest in expected.items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != digest:
        sys.exit('error: package checksum mismatch: ' + name)
PY
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
python3 - "$root/systemd/native-agent-host-broker.socket" "$root/systemd/native-agent-host-broker.service" <<'PY'
import pathlib, sys

def directives(path, section):
    active = None
    found = {}
    seen_sections = set()
    for line in pathlib.Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith(('#', ';')): continue
        if line.endswith('\\'):
            sys.exit('error: broker unit continuation is not permitted')
        if line.startswith('['):
            if not line.endswith(']') or line not in ('[Unit]', '[Service]', '[Socket]', '[Install]'):
                sys.exit('error: broker unit section invalid')
            if line in seen_sections:
                sys.exit('error: duplicate broker unit section')
            seen_sections.add(line)
            active = line
            continue
        if '=' not in line:
            sys.exit('error: broker unit directive invalid')
        key, value = line.split('=', 1)
        if active is None:
            sys.exit('error: broker directive outside section')
        if active == section:
            found.setdefault(key.strip(), []).append(value.strip())
    return found

socket = directives(sys.argv[1], '[Socket]')
service = directives(sys.argv[2], '[Service]')
for values, key, expected in [
    (socket, 'ListenStream', '/run/native-agent-host/broker.sock'),
    (socket, 'SocketUser', 'root'),
    (socket, 'SocketGroup', 'native-agent-host-gateway'),
    (socket, 'SocketMode', '0660'),
    (socket, 'DirectoryMode', '0750'),
    (socket, 'FileDescriptorName', 'broker'),
    (socket, 'RemoveOnStop', 'yes'),
    (service, 'User', 'root'),
    (service, 'Group', 'root'),
    (service, 'ExecStart', '/opt/native-agent-host/current/native-agent-host broker exec'),
    (service, 'Restart', 'no'),
]:
    if values.get(key) != [expected]:
        sys.exit(f'error: packaged broker {key} differs or duplicates')
# Additional directives can override the reviewed privilege boundary (including
# ExecStartPre/Post and systemd socket options); only reviewed keys may ship.
if set(socket) != {'ListenStream','SocketUser','SocketGroup','SocketMode','DirectoryMode','FileDescriptorName','RemoveOnStop','Service'}:
    sys.exit('error: broker socket directive inventory differs')
if set(service) != {'Type','User','Group','ExecStart','NoNewPrivileges','ProtectSystem','ProtectHome','ReadWritePaths','PrivateTmp','PrivateDevices','UMask','Restart'}:
    sys.exit('error: broker service directive inventory differs')
for values, expected in [(socket, {'Service':'native-agent-host-broker.service'}), (service, {
    'Type':'simple','NoNewPrivileges':'yes','ProtectSystem':'strict','ProtectHome':'no',
    'ReadWritePaths':'/etc /var/lib/native-agent-host /home /run/native-agent-host',
    'PrivateTmp':'yes','PrivateDevices':'yes','UMask':'0077'})]:
    for key, value in expected.items():
        if values.get(key) != [value]:
            sys.exit(f'error: packaged broker {key} differs or duplicates')
PY
if find "$root/web" -type f -name '*.map' | grep -q . || grep -R -E 'Alder-testifixture|Deterministinen testi: daemon|VITE_ENABLE_TEST_FIXTURES' "$root/web" >/dev/null;then echo 'error: test fixture content, control or source map in packaged web assets' >&2;exit 1;fi
version=$($root/bin/native-agent-host --json version);python3 -c 'import json,sys;x=json.load(sys.stdin);assert x["data"]["commit"] and len(x["data"]["commit"])==40'<<<"$version"
sha=$(sha256sum "$archive"|cut -d' ' -f1);if $json;then printf '{"schema_version":1,"data":{"status":"verified","archive":"%s","sha256":"%s"},"warnings":[]}\n' "$archive" "$sha";else echo "verified $archive $sha";fi
