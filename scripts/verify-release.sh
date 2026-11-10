#!/usr/bin/env bash
set -euo pipefail
# Archive extraction can be large even when verification runs outside CI.
export TMPDIR=${TMPDIR:-/var/tmp}
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
        expected_mode = 0o755 if m.isdir() or m.name in (root + '/bin/open-habitat', root + '/bin/runtime-release') else 0o644
        if m.mode != expected_mode:
            sys.exit('error: archive entry has noncanonical permissions')
        seen.add(m.name)
    tar.extractall(dest, filter='data')
PY
root=$(find "$tmp" -mindepth 1 -maxdepth 1 -type d);[[ -n $root ]]
for p in bin/open-habitat bin/runtime-release web/index.html systemd/open-habitat-gateway.service systemd/open-habitat-broker.service systemd/open-habitat-broker.socket systemd/open-habitat-revoke.socket systemd/open-habitat-daemon@.service systemd/open-habitat-daemon@.socket systemd/open-habitat-agent@.socket systemd/open-habitat-proc.service systemd/open-habitat-storage.service systemd/open-habitat-binding@.service systemd/polkit.service.d/open-habitat-proc.conf systemd/systemd-logind.service.d/open-habitat-proc.conf sysusers.d/open-habitat.conf tmpfiles.d/open-habitat.conf MANIFEST.sha256 licenses/DEPENDENCIES.md site/schema.json site/example.json operator/SKILL.md;do [[ -f "$root/$p" ]]||{ echo "error: package missing $p" >&2;exit 1;};done
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
allowed = {'bin/open-habitat', 'bin/runtime-release', 'MANIFEST.sha256', 'licenses/DEPENDENCIES.md',
           'site/schema.json', 'site/example.json', 'operator/SKILL.md',
           'systemd/open-habitat-gateway.service', 'systemd/open-habitat-revoke.socket',
           'systemd/open-habitat-daemon@.service', 'systemd/open-habitat-daemon@.socket',
           'systemd/open-habitat-agent@.socket',
           'systemd/open-habitat-broker.service', 'systemd/open-habitat-broker.socket',
           'systemd/open-habitat-proc.service', 'systemd/open-habitat-storage.service', 'systemd/open-habitat-binding@.service',
           'systemd/polkit.service.d/open-habitat-proc.conf',
           'systemd/systemd-logind.service.d/open-habitat-proc.conf',
           'sysusers.d/open-habitat.conf', 'tmpfiles.d/open-habitat.conf'}
if any(not (name in allowed or name.startswith('web/')) for name in actual):
    sys.exit('error: package contains unreviewed files outside web assets')
for name, digest in expected.items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != digest:
        sys.exit('error: package checksum mismatch: ' + name)
PY
# The package name promises an architecture; both executables must keep it.
python3 - "$root" <<'PY'
import pathlib, re, struct, sys
root = pathlib.Path(sys.argv[1])
match = re.fullmatch(r'open-habitat-.+-linux-(amd64|arm64)', root.name)
if not match:
    sys.exit('error: package name lacks a supported linux target')
machine = {'amd64': 62, 'arm64': 183}[match.group(1)]
for name in ('bin/open-habitat', 'bin/runtime-release'):
    head = (root / name).read_bytes()[:20]
    if len(head) < 20 or head[:6] != b'\x7fELF\x02\x01' or struct.unpack('<H', head[18:20])[0] != machine:
        sys.exit(f'error: {name} is not a 64-bit little-endian linux-{match.group(1)} executable')
PY
# Pin the root-only control socket and gateway dependency as one authority change.
python3 - "$root/systemd/open-habitat-revoke.socket" "$root/systemd/open-habitat-gateway.service" <<'PY'
import pathlib, sys

def sections(path):
    result = {}
    current = None
    for raw in pathlib.Path(path).read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith(('#',';')): continue
        if line.startswith('[') and line.endswith(']'):
            if line in result: sys.exit('error: duplicate control unit section')
            current = line
            result[current] = {}
            continue
        if current is None or '=' not in line or line.endswith('\\'):
            sys.exit('error: invalid control unit syntax')
        key, value = line.split('=',1)
        if key in result[current]: sys.exit('error: duplicate control unit directive')
        result[current][key] = value
    return result

socket = sections(sys.argv[1])
if socket != {
    '[Unit]':{'Description':'Root-only gateway subject revocation control','Requires':'open-habitat-storage.service','After':'open-habitat-storage.service'},
    '[Socket]':{'ListenStream':'/run/open-habitat/revoke.sock', 'SocketUser':'root',
        'SocketGroup':'root', 'SocketMode':'0600', 'DirectoryMode':'0750', 'FileDescriptorName':'revoke',
        'RemoveOnStop':'yes', 'Service':'open-habitat-gateway.service'},
    '[Install]':{'WantedBy':'sockets.target'}
}: sys.exit('error: packaged revoke socket directive inventory differs')
gateway = sections(sys.argv[2])
if gateway.get('[Unit]',{}).get('Requires') != 'open-habitat-storage.service open-habitat-proc.service open-habitat-revoke.socket' or \
   gateway.get('[Unit]',{}).get('After') != 'open-habitat-storage.service open-habitat-proc.service network-online.target open-habitat-revoke.socket':
    sys.exit('error: packaged gateway control socket dependency differs')
PY
# These root-run units establish the host-wide process boundary. Accept only
# the reviewed directives, including service ordering and the narrow exemption.
python3 - "$root" <<'PYPROC'
import pathlib, sys
root = pathlib.Path(sys.argv[1])
def unit(name):
    result = {}; section = None
    for raw in (root / 'systemd' / name).read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith(('#', ';')): continue
        if line.startswith('[') and line.endswith(']'):
            section = line
            if section in result: sys.exit('error: duplicate proc policy section')
            result[section] = {}; continue
        if section is None or '=' not in line or line.endswith('\\'):
            sys.exit('error: invalid proc policy directive')
        key, value = (part.strip() for part in line.split('=', 1))
        if key in result[section]: sys.exit('error: duplicate proc policy directive')
        result[section][key] = value
    return result
expected = {
    '[Unit]': {'Description': "Hide other users' processes on the host",
        'DefaultDependencies': 'no', 'Requires': 'systemd-sysusers.service',
        'After': 'systemd-remount-fs.service systemd-sysusers.service', 'Before': 'sysinit.target'},
    '[Service]': {'Type': 'oneshot',
        'ExecStart': '/usr/bin/mount -o remount,hidepid=invisible,gid=@PROC_GID@ /proc',
        'RemainAfterExit': 'yes'},
    '[Install]': {'WantedBy': 'sysinit.target'}}
if unit('open-habitat-proc.service') != expected:
    sys.exit('error: proc policy service differs')
if unit('open-habitat-storage.service') != {
    '[Unit]': {'Description': 'Verify Open Habitat home UUID and enforced journaled user quotas',
        'DefaultDependencies': 'no', 'StartLimitIntervalSec': '0', 'RequiresMountsFor': '/home',
        'Requires': 'open-habitat-proc.service systemd-tmpfiles-setup.service',
        'After': 'local-fs.target open-habitat-proc.service systemd-tmpfiles-setup.service',
        'Before': 'shutdown.target', 'Conflicts': 'shutdown.target'},
    '[Service]': {'Type': 'oneshot',
        'ExecStart': '/opt/open-habitat/current/open-habitat boot-storage-check',
        'User': 'root', 'Group': 'root', 'UMask': '0077'}}:
    sys.exit('error: storage boot gate differs')
if unit('open-habitat-binding@.service') != {
    '[Unit]': {'Description': 'Verify committed binding and cold listener ACLs for %i', 'DefaultDependencies': 'no',
        'StartLimitIntervalSec': '0',
        'Requires': 'open-habitat-storage.service', 'After': 'open-habitat-storage.service',
        'Before': 'shutdown.target', 'Conflicts': 'shutdown.target'},
    '[Service]': {'Type': 'oneshot', 'User': 'root',
        'ExecStart': '/opt/open-habitat/current/open-habitat binding-activation-check %i',
        'RemainAfterExit': 'no', 'TimeoutStartSec': '40s', 'UMask': '0077'}}:
    sys.exit('error: committed binding gate differs')
for name in ('polkit', 'systemd-logind'):
    if unit(name + '.service.d/open-habitat-proc.conf') != {
        '[Unit]': {'Wants': 'open-habitat-proc.service', 'After': 'open-habitat-proc.service'},
        '[Service]': {'SupplementaryGroups': 'open-habitat-proc'}}:
        sys.exit('error: proc policy exemption differs')
if unit('open-habitat-agent@.socket') != {
    '[Unit]': {'Description': 'Open Habitat own-user agent socket for %i',
        'Requires': 'open-habitat-storage.service open-habitat-binding@%i.service', 'After': 'open-habitat-storage.service open-habitat-binding@%i.service'},
    '[Socket]': {'ListenStream': '/run/open-habitat/users/%i/agent.sock',
        'SocketMode': '0600', 'SocketUser': '%i', 'SocketGroup': '%i',
        'DirectoryMode': '0710', 'FileDescriptorName': 'agent',
        'Service': 'open-habitat-daemon@%i.service', 'RemoveOnStop': 'yes'},
    '[Install]': {'WantedBy': 'sockets.target'}}:
    sys.exit('error: agent socket policy differs')
daemon_deps = unit('open-habitat-daemon@.service')['[Unit]']
for socket in ('open-habitat-daemon@%i.socket', 'open-habitat-agent@%i.socket'):
    if socket not in daemon_deps.get('Requires', '').split() or socket not in daemon_deps.get('After', '').split():
        sys.exit('error: daemon requires both ordered sockets')
# One OOM-killed agent build must not stop every conversation of the person.
if unit('open-habitat-daemon@.service')['[Service]'].get('OOMPolicy') != 'continue':
    sys.exit('error: daemon unit must keep running when one of its processes is OOM-killed')
# Agents' /var/tmp outlives a daemon restart but stays the person's own, and
# /tmp stays private; the tmpfiles policy ages the persistent directory.
daemon = unit('open-habitat-daemon@.service')['[Service]']
if {k: daemon.get(k) for k in ('PrivateTmp', 'StateDirectory', 'StateDirectoryMode', 'BindPaths')} != {
        'PrivateTmp': 'yes', 'StateDirectory': 'open-habitat-tmp/%i', 'StateDirectoryMode': '0700',
        'BindPaths': '/var/lib/open-habitat-tmp/%i:/var/tmp'}:
    sys.exit('error: daemon unit must keep /tmp private and bind its own persistent /var/tmp')
if 'e /var/lib/open-habitat-tmp/* - - - 30d' not in (root / 'tmpfiles.d/open-habitat.conf').read_text().splitlines():
    sys.exit('error: tmpfiles policy must age the daemon units\' persistent /var/tmp')
for name in ('gateway', 'daemon@'):
    deps = unit('open-habitat-' + name + '.service')['[Unit]']
    if 'open-habitat-proc.service' not in deps.get('Requires', '').split() or 'open-habitat-proc.service' not in deps.get('After', '').split():
        sys.exit('error: missing proc policy dependency')
lines = [line.strip() for line in (root / 'sysusers.d/open-habitat.conf').read_text().splitlines()
         if line.strip() and not line.lstrip().startswith('#')]
if lines != ['u open-habitat-gateway - "Open Habitat gateway" /nonexistent', 'g open-habitat-proc -']:
    sys.exit('error: proc policy group must have no ordinary members')
PYPROC
# Gateway secrets must not share the daemon binding tree. The latter has
# root:root 0711 parents; the former is root:gateway 0750 on installation.
python3 - "$root/systemd/open-habitat-gateway.service" "$root/systemd/open-habitat-daemon@.service" <<'PY'
import pathlib, sys
for path, expected in zip(sys.argv[1:], (
    '--config /etc/open-habitat/gateway.json',
    '--config /etc/open-habitat-daemon/daemon/user-mappings/daemon-%i.json',
)):
    commands = [line for line in pathlib.Path(path).read_text().splitlines() if line.startswith('ExecStart=')]
    if len(commands) != 1 or not commands[0].endswith(expected):
        sys.exit('error: packaged gateway/daemon config path separation differs')
PY
# A valid checksum is not a security policy: reject world-searchable fallback
# directories even when a package has a matching, freshly generated manifest.
python3 - "$root/systemd/open-habitat-daemon@.socket" <<'PY'
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
for key in ('Requires', 'After'):
    values = [line.strip().split('=',1)[1].strip() for line in unit.splitlines()
              if '=' in line and line.strip().split('=',1)[0].strip() == key]
    if values != ['open-habitat-storage.service open-habitat-binding@%i.service']:
        sys.exit('error: missing ordered storage gate')
PY
python3 - "$root/systemd/open-habitat-broker.socket" "$root/systemd/open-habitat-broker.service" <<'PY'
import pathlib, sys

def directives(path):
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
        found.setdefault(active, {}).setdefault(key.strip(), []).append(value.strip())
    return found

def require_section(unit, section, expected):
    if unit.get(section) != {key: [value] for key, value in expected.items()}:
        sys.exit(f'error: broker {section} directive inventory differs')

socket_unit = directives(sys.argv[1])
service_unit = directives(sys.argv[2])
require_section(socket_unit, '[Unit]', {'Description':'Open Habitat restricted root broker socket',
    'Requires':'open-habitat-storage.service', 'After':'open-habitat-storage.service'})
require_section(socket_unit, '[Install]', {'WantedBy':'sockets.target'})
require_section(service_unit, '[Unit]', {
    'Description':'Open Habitat root account broker',
    'Requires':'open-habitat-storage.service open-habitat-proc.service open-habitat-broker.socket',
    'After':'open-habitat-storage.service open-habitat-proc.service open-habitat-broker.socket'})
require_section(service_unit, '[Install]', {'WantedBy':'multi-user.target'})
if set(socket_unit) != {'[Unit]', '[Socket]', '[Install]'} or set(service_unit) != {'[Unit]', '[Service]', '[Install]'}:
    sys.exit('error: broker unit section inventory differs')
socket = socket_unit['[Socket]']
service = service_unit['[Service]']
for values, key, expected in [
    (socket, 'ListenStream', '/run/open-habitat/broker.sock'),
    (socket, 'SocketUser', 'root'),
    (socket, 'SocketGroup', 'open-habitat-gateway'),
    (socket, 'SocketMode', '0660'),
    (socket, 'DirectoryMode', '0750'),
    (socket, 'FileDescriptorName', 'broker'),
    (socket, 'RemoveOnStop', 'yes'),
    (service, 'User', 'root'),
    (service, 'Group', 'root'),
    (service, 'ExecStart', '/opt/open-habitat/current/open-habitat broker exec'),
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
for values, expected in [(socket, {'Service':'open-habitat-broker.service'}), (service, {
    'Type':'simple','NoNewPrivileges':'yes','ProtectSystem':'strict','ProtectHome':'no',
    'ReadWritePaths':'/etc /var/lib/open-habitat /home /run/open-habitat /opt/open-habitat',
    'PrivateTmp':'yes','PrivateDevices':'yes','UMask':'0077'})]:
    for key, value in expected.items():
        if values.get(key) != [value]:
            sys.exit(f'error: packaged broker {key} differs or duplicates')
PY
if find "$root/web" -type f -name '*.map' | grep -q . || grep -R -E 'Synthetic-lab-fixture|Deterministinen testi: daemon|VITE_ENABLE_TEST_FIXTURES' "$root/web" >/dev/null;then echo 'error: test fixture content, control or source map in packaged web assets' >&2;exit 1;fi
case $(uname -m) in x86_64) host=amd64;; aarch64) host=arm64;; *) host=;; esac
warnings='[]'
if [[ $root == *-linux-$host ]]; then
  version=$($root/bin/open-habitat --json version);python3 -c 'import json,sys;x=json.load(sys.stdin);assert x["data"]["commit"] and len(x["data"]["commit"])==40'<<<"$version"
else
  # A binary for another architecture cannot run here, and -trimpath keeps Go
  # from recording the link flags that set its commit. Verify it on its own
  # architecture to cover its embedded identity.
  warnings='["embedded_identity_unverified: the package targets another architecture than this host"]'
fi
sha=$(sha256sum "$archive"|cut -d' ' -f1);if $json;then printf '{"schema_version":1,"data":{"status":"verified","archive":"%s","sha256":"%s"},"warnings":%s}\n' "$archive" "$sha" "$warnings";else echo "verified $archive $sha";fi
