#!/usr/bin/env python3
"""Release qualification on a fresh real Ubuntu 24.04 VM, installed like a customer.

`plan` validates published release directories offline. `target` drives an
already booted stock VM over pinned SSH through the released `open-habitat host`
operator only. `run` asks Fleetrepo's qualification-VM operator for a short-lived
cloud VM, runs `target` against it and always destroys it. This script holds no
cloud credentials; provisioning, firewalling and expiry belong to that operator.
"""
import argparse
import datetime
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import shutil
import signal
import socket
import ssl
import subprocess
import sys
import tarfile
import tempfile
import time

SCHEMA = 1
OPERATOR = 'open-habitat-qualification-vm'
TLS_NAME = 'qualification.invalid'
# The editor profile needs its own wildcard origin; the per-run leaf covers it too.
EDITOR_TEMPLATE = 'https://*.code.' + TLS_NAME
SITE = '/etc/open-habitat/site.json'
SECRETS = '/etc/open-habitat/secrets'
INCOMING = '/var/lib/open-habitat/release'
WORK = '/root/open-habitat-qualification'
GATEWAY = 31000
POOL = (32000, 32015)
PEOPLE = (('1001', 'qualone'), ('1002', 'qualtwo'))
DEFAULT_LIMIT = 1073741824
OVERRIDE_LIMIT = 536870912
# Every installation ships the integration tools; only app registrations are
# the customer's. Before the upgrade the harness enters a placeholder Dropbox
# registration, as a customer would, which must then survive byte-for-byte.
INTEGRATION_TOOLS = {'curl', 'gog', 'himalaya', 'microsoft-native', 'ms-365-mcp-server', 'pi', 'rclone', 'tea'}
INTEGRATIONS_INSTALLED = {'imap': [True, None], 'caldav': [True, None], 'carddav': [True, None],
                          'google': [False, 'app_credentials_required'],
                          'microsoft': [False, 'app_credentials_required'],
                          'dropbox': [False, 'app_credentials_required']}
PACKAGE_RE = re.compile(r'^open-habitat-[0-9A-Za-z.+-]+-linux-(amd64|arm64)\.tar\.gz$')
# What uname -m reports for each package architecture.
MACHINES = {'amd64': 'x86_64', 'arm64': 'aarch64'}
NOT_COVERED = [
    'browser GitHub OAuth sign-in and callback',
    'model-provider authorization and a real conversation',
    'public-CA certificate issuance, DNS and ingress (a per-run CA signs the leaf)',
    'per-profile native workflows (editor, containers, browser, uv/python, integrations)',
    'power-loss torn writes (interruptions are SIGKILL of the operator process)',
]


class Failure(Exception):
    def __init__(self, code, message, detail=None):
        super().__init__(message)
        self.code, self.message, self.detail = code, message, detail


class Usage(Failure):
    pass


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def tail(text, limit=2048):
    text = text or ''
    return text[-limit:]


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


# ---------------------------------------------------------------- inputs

def release_bundle(directory):
    """One published release: product package, signed runtime manifest, archives."""
    root = Path(directory)
    if not root.is_dir():
        raise Usage('release_directory_missing', f'{directory} is not a directory')
    packages = sorted(p.name for p in root.iterdir() if PACKAGE_RE.match(p.name))
    if len(packages) != 1:
        raise Usage('release_package_ambiguous', f'{directory} must hold exactly one open-habitat-*-linux-<amd64|arm64>.tar.gz package, found {len(packages)}')
    for name in ('release.json', 'release.sig'):
        if not (root / name).is_file():
            raise Usage('release_manifest_missing', f'{directory} lacks {name}')
    try:
        manifest = json.loads((root / 'release.json').read_text())
        artifacts = manifest['artifacts']
        archives = [a['archive'] for a in artifacts]
        profiles = sorted({a['profile'] for a in artifacts})
        version = manifest['version']
        platform = manifest['platform']
    except (OSError, ValueError, KeyError, TypeError):
        raise Usage('release_manifest_invalid', f'{directory}/release.json is not a release manifest') from None
    for name in archives:
        if '/' in name or not (root / name).is_file():
            raise Usage('release_archive_missing', f'{directory} lacks runtime archive {name}')
    package = root / packages[0]
    arch = PACKAGE_RE.match(package.name).group(1)
    if platform != 'ubuntu-24.04-' + arch:
        raise Usage('release_platform_mismatch', f'{package.name} does not match the runtime manifest platform {platform}')
    try:
        with tarfile.open(package, 'r:gz') as tar:
            tops = {m.name.split('/', 1)[0] for m in tar.getmembers()}
            if len(tops) != 1:
                raise Usage('release_package_invalid', f'{package.name} must have one top-level directory')
            top = tops.pop()
            member = tar.extractfile(top + '/bin/open-habitat')
            binary = hashlib.sha256(member.read()).hexdigest() if member else None
    except (tarfile.TarError, OSError, KeyError):
        raise Usage('release_package_invalid', f'{package.name} is not a readable product package with bin/open-habitat') from None
    if not binary:
        raise Usage('release_package_invalid', f'{package.name} lacks bin/open-habitat')
    return {
        'directory': str(root.resolve()),
        'version': version,
        'manifest_sha256': sha256(root / 'release.json'),
        'package': package.name,
        'package_sha256': sha256(package),
        'package_top': top,
        'arch': arch,
        'binary_sha256': binary,
        'files': ['release.json', 'release.sig', *archives],
        'archive_sha256': {a['archive']: a.get('sha256') for a in artifacts},
        'profiles': profiles,
        'upgrade': manifest.get('upgrade'),
    }


def inputs(args):
    key = Path(args.release_key)
    if not key.is_file() or key.stat().st_size != 32:
        raise Usage('release_key_invalid', 'release key must be the raw 32-byte Ed25519 public key file')
    pred = release_bundle(args.predecessor)
    succ = release_bundle(args.successor) if args.successor else None
    if succ and succ['arch'] != pred['arch']:
        raise Usage('release_platform_mismatch', 'an upgrade keeps the architecture: predecessor and successor must target the same platform')
    if succ:
        prior = (succ['upgrade'] or {}).get('predecessor') or {}
        if prior.get('version') != pred['version'] or prior.get('manifest_sha256') != pred['manifest_sha256']:
            raise Usage('successor_not_for_predecessor', 'successor release.json does not name this exact predecessor version and manifest digest')
    profiles = sorted(set(args.profiles.split(','))) if args.profiles else pred['profiles']
    for p in profiles:
        if p not in pred['profiles'] or (succ and p not in succ['profiles']):
            raise Usage('profile_not_released', f'profile {p} is not in every supplied release')
    if not {'core', 'integrations'} <= set(profiles):
        raise Usage('profile_required', 'every installation selects the core and integrations profiles')
    return {'predecessor': pred, 'successor': succ, 'release_key': str(key.resolve()),
            'release_key_sha256': sha256(key), 'profiles': profiles}


def stages(spec):
    names = ['connect', 'baseline_updates', 'home_volume', 'deliver', 'prepare', 'apply',
             'first_use', 'reboot_installed']
    if spec['successor']:
        names += ['upgrade', 'reboot_upgraded']
    return names


def load_target(path):
    try:
        t = json.loads(Path(path).read_text())
    except (OSError, ValueError):
        raise Usage('target_invalid', f'cannot read target JSON {path}') from None
    need = {'host': str, 'port': int, 'user': str, 'identity_file': str, 'known_hosts': str, 'home_device': str}
    for k, kind in need.items():
        if not isinstance(t.get(k), kind) or (kind is str and not t[k]):
            raise Usage('target_invalid', f'target.{k} is required ({kind.__name__})')
    if not t['home_device'].startswith('/dev/'):
        raise Usage('target_invalid', 'target.home_device must be a /dev path')
    if not Path(t['identity_file']).is_file():
        raise Usage('target_invalid', 'target.identity_file does not exist')
    if 'ssh-ed25519 ' not in t['known_hosts']:
        raise Usage('target_invalid', 'target.known_hosts must pin the ed25519 host key')
    return t


# ---------------------------------------------------------------- transport

class SSH:
    """Pinned, non-interactive SSH. Every remote argv is quoted for the remote shell."""

    def __init__(self, target, private):
        self.t = target
        self.known = Path(private) / 'known_hosts'
        self.known.write_text(target['known_hosts'].rstrip('\n') + '\n')
        self.base = ['ssh', '-F', '/dev/null', '-p', str(target['port']), '-i', target['identity_file'],
                     '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes',
                     '-o', 'UserKnownHostsFile=' + str(self.known), '-o', 'HostKeyAlgorithms=ssh-ed25519',
                     '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4',
                     '-o', 'LogLevel=ERROR', target['user'] + '@' + target['host'], '--']
        self.sudo = [] if target['user'] == 'root' else ['sudo', '-n']

    def remote(self, argv):
        return self.base + [shlex.join(self.sudo + list(argv))]

    def run(self, argv, input=None, timeout=900, check=True):
        try:
            p = subprocess.run(self.remote(argv), input=input, capture_output=True, timeout=timeout,
                               text=not isinstance(input, bytes))
        except subprocess.TimeoutExpired:
            raise Failure('remote_timeout', f'remote command timed out after {timeout}s: {argv[0]}') from None
        if isinstance(input, bytes):
            p = subprocess.CompletedProcess(p.args, p.returncode, p.stdout.decode(errors='replace'), p.stderr.decode(errors='replace'))
        if check and p.returncode != 0:
            raise Failure('remote_command_failed', f'remote {argv[0]} exited {p.returncode}',
                          {'argv': list(argv)[:6], 'stdout': tail(p.stdout), 'stderr': tail(p.stderr)})
        return p

    def put(self, source, remote, mode):
        """Atomic root-owned upload; source is a local path or bytes."""
        script = 'umask 077; cat > "$1.part" && chown root:root "$1.part" && chmod "$2" "$1.part" && mv -f "$1.part" "$1"'
        argv = ['sh', '-c', script, 'sh', remote, mode]
        if isinstance(source, bytes):
            self.run(argv, input=source)
            return
        with open(source, 'rb') as f:
            p = subprocess.run(self.remote(argv), stdin=f, capture_output=True, timeout=3600)
        if p.returncode != 0:
            raise Failure('upload_failed', f'upload to {remote} failed', {'stderr': tail(p.stderr.decode(errors='replace'))})

    def stream(self, argv):
        # The remote shell reports its PID, then execs the operator in place so a
        # deliberate interruption can kill exactly that process.
        wrapped = ['sh', '-c', 'echo "$$"; exec "$@"', 'sh', *argv]
        return subprocess.Popen(self.remote(wrapped), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    def reachable(self):
        try:
            return subprocess.run(self.remote(['cat', '/proc/sys/kernel/random/boot_id']), capture_output=True,
                                  text=True, timeout=30)
        except subprocess.TimeoutExpired:
            return None

    def sleep(self, seconds):
        time.sleep(seconds)


def https_status(host, server_name, cafile, path='/healthz', timeout=10):
    """CA- and hostname-validated HTTPS from the qualification host; None when not served."""
    ctx = ssl.create_default_context(cafile=cafile)
    try:
        raw = socket.create_connection((host, 443), timeout=timeout)
        conn = http.client.HTTPSConnection(server_name, 443, context=ctx, timeout=timeout)
        conn.sock = ctx.wrap_socket(raw, server_hostname=server_name)
        conn.request('GET', path, headers={'Host': server_name})
        return conn.getresponse().status
    except ssl.SSLCertVerificationError as e:
        raise Failure('tls_verification_failed', f'gateway certificate did not verify: {e.verify_message}') from None
    except OSError:
        return None


def make_tls(private):
    """Per-run CA (key stays local) and a leaf for the declared origin."""
    d = Path(private)
    def ossl(*a):
        subprocess.run(['openssl', *a], check=True, capture_output=True)
    ossl('req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-days', '2',
         '-subj', '/CN=open-habitat qualification CA', '-keyout', str(d / 'ca.key'), '-out', str(d / 'ca.crt'),
         '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign')
    ossl('req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-subj', '/CN=' + TLS_NAME,
         '-keyout', str(d / 'tls.key'), '-out', str(d / 'tls.csr'))
    (d / 'leaf.ext').write_text(f'subjectAltName=DNS:{TLS_NAME},DNS:*.code.{TLS_NAME}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n')
    ossl('x509', '-req', '-in', str(d / 'tls.csr'), '-CA', str(d / 'ca.crt'), '-CAkey', str(d / 'ca.key'),
         '-CAcreateserial', '-days', '2', '-extfile', str(d / 'leaf.ext'), '-out', str(d / 'tls.crt'))
    return {'ca': str(d / 'ca.crt'), 'cert': str(d / 'tls.crt'), 'key': str(d / 'tls.key')}


# ---------------------------------------------------------------- remote probes

# Observation only, run as root through `python3 -`: synthetic first login over
# the broker socket as the gateway UID, own-UID daemon health and native-state
# hashes. Installation itself never runs anything but the released operator.
PROBE = r'''
import hashlib, json, os, pwd, socket, struct, subprocess, sys, time

def drop(uid, gid):
    def child():
        os.setgroups([]); os.setgid(gid); os.setuid(uid)
    return child

def as_user(uid, gid, code, *args):
    return subprocess.run([sys.executable, '-c', code, *args], preexec_fn=drop(uid, gid), capture_output=True, text=True, timeout=30)

ENSURE = """import json,socket,struct,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(100);s.connect('/run/open-habitat/broker.sock')
b=sys.argv[1].encode();s.sendall(struct.pack('>I',len(b))+b);s.shutdown(socket.SHUT_WR)
h=s.recv(4);n=struct.unpack('>I',h)[0];b=b''
while len(b)<n:
    p=s.recv(n-len(b));assert p;b+=p
print(b.decode())"""

AGENT = """import socket,sys
s=socket.socket(socket.AF_UNIX);s.settimeout(5);s.connect(sys.argv[1])
s.sendall(b'GET /agent/v1/environment HTTP/1.1\\r\\nHost: unix\\r\\nConnection: close\\r\\n\\r\\n')
b=s.recv(64);sys.exit(0 if b.startswith(b'HTTP/1.1 200 ') else 3)"""

LIST = """import http.client,json,socket,sys
class C(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX);self.sock.settimeout(30);self.sock.connect(sys.argv[1])
c=C('unix');c.request('GET','/api/v1/integrations');r=c.getresponse();b=r.read()
if r.status!=200: sys.exit(3)
print(json.dumps({p['id']:[p['available'],p.get('unavailable_reason')] for p in json.loads(b)['providers']}))"""

CONFIG = '/opt/open-habitat/integrations.json'

def integrations(name, gw_uid, gw_gid):
    # The gateway's view of the person's catalog, exactly as the browser gets it.
    sock = '/run/open-habitat/users/' + name + '/daemon.sock'
    end = time.monotonic() + 180
    while True:
        p = as_user(int(gw_uid), int(gw_gid), LIST, sock)
        if p.returncode == 0:
            break
        if time.monotonic() > end:
            sys.exit('integration catalog never answered for ' + name)
        time.sleep(1)
    print(json.dumps({'providers': json.loads(p.stdout)}))

def integrations_config():
    st = os.lstat(CONFIG)
    data = open(CONFIG, 'rb').read()
    tools = {}
    for name, path in json.loads(data)['tools'].items():
        t = os.stat(path)
        tools[name] = {'path': path, 'root_owned': t.st_uid == 0 and not t.st_mode & 0o022, 'executable': bool(t.st_mode & 0o111)}
    print(json.dumps({'sha256': hashlib.sha256(data).hexdigest(), 'owner': st.st_uid, 'mode': st.st_mode & 0o7777,
                      'links': st.st_nlink, 'sections': sorted(json.loads(data)), 'tools': tools}))

def add_app():
    # The customer enters an app registration beside the product's tools.
    data = open(CONFIG, 'rb').read().rstrip()
    assert data.endswith(b'}')
    data = data[:-1] + b',\n  "dropbox": {\n    "client_id": "qualification-app",\n    "client_secret": "qualification-placeholder"\n  }\n}\n'
    json.loads(data)
    with open(CONFIG + '.customer', 'xb') as f:
        f.write(data); os.fchmod(f.fileno(), 0o644); f.flush(); os.fsync(f.fileno())
    os.rename(CONFIG + '.customer', CONFIG)
    print(json.dumps({'sha256': hashlib.sha256(data).hexdigest()}))

def ensure(subject, name, gw_uid, gw_gid, limit):
    req = {'version': 1, 'operation': 'ensure', 'provider': 'github', 'id': subject, 'candidate': name, 'default_limit_bytes': int(limit)}
    p = as_user(int(gw_uid), int(gw_gid), ENSURE, json.dumps(req))
    if p.returncode != 0:
        sys.exit('ensure failed: ' + p.stderr[-500:])
    route = json.loads(p.stdout).get('route')
    if not route or route['username'] != name:
        sys.exit('ensure refused: ' + p.stdout[-500:])
    print(json.dumps({'uid': route['uid'], 'username': name}))

def agent(name, other):
    # No root service start: connecting as the person is the only activation
    # path a customer has, so the probe observes it rather than repairing it.
    me, them = pwd.getpwnam(name), pwd.getpwnam(other)
    sockets = {u: subprocess.run(['systemctl', 'is-active', u], capture_output=True, text=True).stdout.strip()
               for u in ('open-habitat-daemon@' + name + '.socket', 'open-habitat-agent@' + name + '.socket')}
    sock = '/run/open-habitat/users/' + name + '/agent.sock'
    end = time.monotonic() + 180
    while as_user(me.pw_uid, me.pw_gid, AGENT, sock).returncode != 0:
        if time.monotonic() > end:
            sys.exit('own-UID agent environment never answered 200 for ' + name + ' ' + json.dumps(sockets))
        time.sleep(1)
    denied = as_user(them.pw_uid, them.pw_gid, AGENT, sock).returncode != 0
    print(json.dumps({'uid': me.pw_uid, 'own_uid_200': True, 'other_uid_denied': denied, 'sockets_before_connect': sockets}))

def state(name, write):
    u = pwd.getpwnam(name)
    path = os.path.join(u.pw_dir, 'qualification-preserved')
    if write == 'write':
        code = "import sys;open(sys.argv[1],'w').write('synthetic native state\\n')"
        if as_user(u.pw_uid, u.pw_gid, code, path).returncode != 0:
            sys.exit('state write failed')
    print(json.dumps({'sha256': hashlib.sha256(open(path, 'rb').read()).hexdigest()}))

def units(*names):
    end = time.monotonic() + 300
    pending = list(names)
    while pending:
        pending = [u for u in pending if subprocess.run(['systemctl', 'is-active', '--quiet', u]).returncode != 0]
        if pending and time.monotonic() > end:
            sys.exit('units not active: ' + ' '.join(pending))
        if pending:
            time.sleep(2)
    print(json.dumps({'active': list(names)}))

def gateway_exe():
    pid = subprocess.run(['systemctl', 'show', '--value', '--property=MainPID', 'open-habitat-gateway.service'], capture_output=True, text=True, check=True).stdout.strip()
    data = open('/proc/' + pid + '/exe', 'rb').read()
    print(json.dumps({'pid': int(pid), 'sha256': hashlib.sha256(data).hexdigest()}))

{'ensure': ensure, 'agent': agent, 'state': state, 'units': units, 'gateway-exe': gateway_exe,
 'integrations': integrations, 'integrations-config': integrations_config, 'add-app': add_app}[sys.argv[1]](*sys.argv[2:])
'''


# ---------------------------------------------------------------- qualification

class Qualification:
    def __init__(self, spec, target, transport, https, tls, log=None, interrupt=True):
        self.spec, self.t, self.r, self.https, self.tls = spec, target, transport, https, tls
        self.log = log or (lambda event: None)
        self.interrupt = interrupt
        self.stages = []
        self.obs = {}
        self.site = None
        self.bin = None
        self.seq = 0

    # -- helpers
    def emit(self, **event):
        self.seq += 1
        self.log({'schema_version': SCHEMA, 'seq': self.seq, **event})

    def probe(self, *args):
        p = self.r.run(['python3', '-', *args], input=PROBE)
        return json.loads(p.stdout.strip().splitlines()[-1])

    def cli(self, binary, *args, check=True):
        return self.r.run([binary, *args], timeout=1800, check=check)

    def dry_run(self, binary, kind):
        p = self.cli(binary, 'host', kind, '--site', SITE, '--dry-run', '--json', check=False)
        try:
            # A blocked read-only qualification exits 1 with its plan under stderr error.result.data.
            data = json.loads(p.stdout)['data'] if p.returncode == 0 else json.loads(p.stderr)['error']['result']['data']
            data['plan']['plan_id']
        except (ValueError, KeyError, TypeError):
            raise Failure(f'{kind}_preview_failed', f'host {kind} --dry-run did not return a plan',
                          {'exit': p.returncode, 'stdout': tail(p.stdout), 'stderr': tail(p.stderr)}) from None
        if p.returncode != 0 or not data['plan']['approvable']:
            blocked = [c for c in data['plan'].get('checks', []) if c.get('status') not in ('pass', None)]
            raise Failure(f'{kind}_not_approvable', f'host {kind} plan is not approvable', {'checks': blocked[:20]})
        return data['plan']

    def flags(self, kind, plan_id):
        extra = {'prepare': ['--approve-disruption'],
                 'upgrade': ['--approve-maintenance', '--approve-interruption']}.get(kind, [])
        return ['host', kind, '--site', SITE, '--approved-plan', plan_id, *extra, '--output=jsonl']

    def live(self, binary, kind, plan_id, interrupt_at=None):
        """Run one approved maintenance; with interrupt_at, SIGKILL it at that phase."""
        proc = self.r.stream([binary, *self.flags(kind, plan_id)])
        pid = proc.stdout.readline().strip()
        events = []
        for line in proc.stdout:
            try:
                e = json.loads(line)
            except ValueError:
                continue
            events.append(e)
            if interrupt_at and e.get('event') == 'progress' and e.get('phase') == interrupt_at:
                self.r.run(['kill', '-KILL', pid])
                proc.kill()
                proc.wait()
                return {'interrupted_at': interrupt_at, 'pid': pid}
        err = proc.stderr.read()
        code = proc.wait()
        terminal = events[-1] if events else {}
        if interrupt_at:
            raise Failure(f'{kind}_interruption_missed', f'host {kind} ended before phase {interrupt_at}', {'terminal': terminal})
        if [e.get('seq') for e in events] != list(range(1, len(events) + 1)):
            raise Failure(f'{kind}_stream_invalid', f'host {kind} event sequence is not contiguous')
        if code != 0 or terminal.get('event') != 'result':
            raise Failure(f'{kind}_failed', f'host {kind} did not finish with a result',
                          {'exit': code, 'terminal': terminal, 'stderr': tail(err)})
        return terminal['data']

    def check(self, binary):
        p = self.cli(binary, 'host', 'check', '--site', SITE, '--json', check=False)
        if p.returncode != 0:
            raise Failure('host_check_failed', 'host check did not pass', {'stdout': tail(p.stdout), 'stderr': tail(p.stderr)})
        return True

    def public(self, expect=200, attempts=30):
        status = None
        for _ in range(attempts):
            status = self.https(self.t['host'], TLS_NAME, self.tls['ca'])
            if status == expect:
                return status
            self.r.sleep(2)
        raise Failure('public_https_unexpected', f'https://{TLS_NAME}/healthz on {self.t["host"]}:443 returned {status}, expected {expect}')

    def boot_id(self):
        return self.r.run(['cat', '/proc/sys/kernel/random/boot_id']).stdout.strip()

    def reboot(self):
        before = self.boot_id()
        self.r.run(['systemctl', 'reboot', '--no-block'], check=False)
        end = time.monotonic() + 900
        while time.monotonic() < end:
            self.r.sleep(10)
            p = self.r.reachable()
            if p is not None and p.returncode == 0 and p.stdout.strip() and p.stdout.strip() != before:
                return p.stdout.strip()
        raise Failure('reboot_timeout', 'target did not return with a new boot ID within 900s')

    def put_release(self, bundle):
        for name in bundle['files']:
            remote = f'{INCOMING}/{name}'
            # A successor usually reuses most archive bytes; resending identical
            # gigabytes over the qualification host's uplink proves nothing.
            want = bundle['archive_sha256'].get(name)
            if want and self.remote_sha256(remote) == want:
                continue
            self.r.put(os.path.join(bundle['directory'], name), remote, '0644')
        got = self.r.run(['sha256sum', f'{INCOMING}/release.json']).stdout.split()[0]
        if got != bundle['manifest_sha256']:
            raise Failure('delivery_corrupted', 'delivered release.json digest differs')

    def remote_sha256(self, remote):
        p = self.r.run(['sha256sum', remote], check=False)
        return p.stdout.split()[0] if p.returncode == 0 and p.stdout.strip() else None

    def put_package(self, bundle):
        remote = f'{WORK}/{bundle["package"]}'
        self.r.put(os.path.join(bundle['directory'], bundle['package']), remote, '0600')
        got = self.r.run(['sha256sum', remote]).stdout.split()[0]
        if got != bundle['package_sha256']:
            raise Failure('delivery_corrupted', 'delivered product package digest differs')
        script = ('set -eu; test ! -e "/opt/$2"; tmp=$(mktemp -d /opt/.oh-extract.XXXXXX); '
                  'tar --no-same-owner -xzf "$1" -C "$tmp"; mv "$tmp/$2" "/opt/$2"; rmdir "$tmp"; '
                  'chown -R root:root "/opt/$2"; chmod -R go-w "/opt/$2"')
        self.r.run(['sh', '-c', script, 'sh', remote, bundle['package_top']])
        return f'/opt/{bundle["package_top"]}/bin/open-habitat'

    def write_site(self):
        self.r.put(json.dumps(self.site, indent=2).encode() + b'\n', SITE, '0600')

    def integrations(self):
        config = self.probe('integrations-config')
        tools = config['tools']
        if set(tools) != INTEGRATION_TOOLS or not all(t['root_owned'] and t['executable'] for t in tools.values()) \
                or config['owner'] != 0 or config['mode'] != 0o644 or config['links'] != 1:
            raise Failure('integration_tools_missing', 'integrations.json does not name every shipped root-owned tool',
                          {'tools': tools, 'owner': config['owner'], 'mode': oct(config['mode'])})
        if self.obs.get('integrations_config_sha256', config['sha256']) != config['sha256']:
            raise Failure('integrations_config_changed', 'integrations.json changed without a release or customer change')
        self.obs['integrations_config_sha256'] = config['sha256']
        want = self.obs.setdefault('integrations_expected', json.loads(json.dumps(INTEGRATIONS_INSTALLED)))
        providers = {n: self.probe('integrations', n, str(GATEWAY), str(GATEWAY))['providers'] for _, n in PEOPLE}
        for name, got in providers.items():
            if got != want:
                raise Failure('integrations_unexpected', f'{name} sees an unexpected integration catalog', {'providers': got, 'expected': want})
        return {'config_sha256': config['sha256'], 'sections': config['sections'], 'tools': sorted(tools),
                'providers': providers[PEOPLE[0][1]]}

    def people(self):
        agents = [self.probe('agent', a, b) for (_, a), (_, b) in zip(PEOPLE, reversed(PEOPLE))]
        if not all(a['other_uid_denied'] for a in agents):
            raise Failure('cross_uid_agent_reachable', 'another person reached a private agent socket')
        return agents

    # -- stages
    def connect(self):
        self.r.run(['cloud-init', 'status', '--wait'], check=False, timeout=900)
        p = self.r.run(['sh', '-c', '. /etc/os-release; echo "$ID $VERSION_ID"; uname -m; cat /proc/1/comm; cat /proc/sys/kernel/random/boot_id'])
        os_id, arch, pid1, boot = p.stdout.split('\n')[:4]
        want = self.spec['predecessor']['arch']
        if os_id != 'ubuntu 24.04' or arch != MACHINES[want] or pid1 != 'systemd':
            raise Failure('target_not_supported_baseline', f'target is {os_id} {arch} pid1={pid1}; this release needs Ubuntu 24.04 {want} with systemd')
        if self.r.run(['test', '-e', '/etc/open-habitat'], check=False).returncode == 0:
            raise Failure('target_not_fresh', 'target already has /etc/open-habitat; use a freshly booted stock image')
        return {'os': os_id, 'arch': arch, 'pid1': pid1, 'boot_id': boot}

    def baseline_updates(self):
        env = ['env', 'DEBIAN_FRONTEND=noninteractive']
        apt = [*env, 'apt-get', '-o', 'DPkg::Lock::Timeout=900']
        sources = self.r.run(['sh', '-c', 'cat /etc/apt/sources.list /etc/apt/sources.list.d/* 2>/dev/null || true']).stdout
        hosts = sorted(set(re.findall(r'https?://([^/\s]+)', sources)))
        mirror = self.t.get('expect_apt_mirror')
        if mirror and mirror not in hosts:
            raise Failure('apt_mirror_unexpected', f'apt sources use {hosts}, expected the stock {mirror} mirror')
        self.r.run([*apt, 'update'], timeout=1800)
        pending = self.r.run(['sh', '-c', 'apt list --upgradable 2>/dev/null | grep -c / || true']).stdout.strip()
        self.r.run([*apt, '-y', '-o', 'Dpkg::Options::=--force-confdef', '-o', 'Dpkg::Options::=--force-confold', 'upgrade'], timeout=3600)
        rebooted = self.r.run(['test', '-e', '/var/run/reboot-required'], check=False).returncode == 0
        if rebooted:
            self.reboot()
        kernel = self.r.run(['uname', '-r']).stdout.strip()
        return {'apt_hosts': hosts, 'upgraded_packages': int(pending or 0), 'rebooted': rebooted, 'kernel': kernel}

    def home_volume(self):
        # Customer-owned storage provisioning: product code never formats or edits fstab.
        dev = self.r.run(['readlink', '-e', self.t['home_device']]).stdout.strip()
        if self.r.run(['blkid', '-p', dev], check=False).returncode != 2:
            raise Failure('home_volume_not_blank', f'{self.t["home_device"]} already carries a signature; refusing to format it')
        if self.r.run(['findmnt', '-S', dev], check=False).returncode == 0:
            raise Failure('home_volume_mounted', f'{dev} is already mounted')
        if self.r.run(['find', '/home', '-mindepth', '1', '-maxdepth', '1']).stdout.strip():
            raise Failure('home_not_empty', '/home on the root filesystem is not empty')
        modules = False
        if self.r.run(['modprobe', 'quota_v2'], check=False).returncode != 0:
            kernel = self.r.run(['uname', '-r']).stdout.strip()
            self.r.run(['env', 'DEBIAN_FRONTEND=noninteractive', 'apt-get', '-o', 'DPkg::Lock::Timeout=900', '-y', 'install', 'linux-modules-extra-' + kernel], timeout=1800)
            self.r.run(['modprobe', 'quota_v2'])
            modules = True
        self.r.run(['mkfs.ext4', '-q', '-F', '-O', 'quota', '-E', 'quotatype=usrquota', dev], timeout=1800)
        self.r.run(['udevadm', 'settle'])
        uuid = self.r.run(['blkid', '-s', 'UUID', '-o', 'value', dev]).stdout.strip()
        self.r.run(['sh', '-c', 'printf "UUID=%s /home ext4 defaults,usrquota 0 2\\n" "$1" >> /etc/fstab', 'sh', uuid])
        self.r.run(['systemctl', 'daemon-reload'])
        self.r.run(['mount', '/home'])
        self.obs['home_uuid'] = uuid
        return {'device': dev, 'uuid': uuid, 'quota_modules_installed': modules}

    def deliver(self):
        pred = self.spec['predecessor']
        self.r.run(['install', '-d', '-o', 'root', '-g', 'root', '-m', '0700', WORK])
        self.r.run(['install', '-d', '-o', 'root', '-g', 'root', '-m', '0711', '/etc/open-habitat'])
        self.r.run(['install', '-d', '-o', 'root', '-g', 'root', '-m', '0700', SECRETS])
        self.r.run(['install', '-d', '-o', 'root', '-g', 'root', '-m', '0755', '/var/lib/open-habitat', INCOMING])
        self.bin = self.put_package(pred)
        self.put_release(pred)
        self.r.put(self.spec['release_key'], '/etc/open-habitat/release-key.pub', '0644')
        self.r.put(self.tls['cert'], f'{SECRETS}/tls.crt', '0600')
        self.r.put(self.tls['key'], f'{SECRETS}/tls.key', '0600')
        self.r.put(('synthetic-' + secrets.token_hex(16)).encode(), f'{SECRETS}/github', '0600')
        origin = 'https://' + TLS_NAME
        self.site = {
            'schema_version': 1, 'site_id': 'qualification',
            'release': {'version': pred['version'], 'manifest_sha256': pred['manifest_sha256']},
            'gateway': {'uid': GATEWAY, 'gid': GATEWAY, 'listen': '0.0.0.0:443', 'origin': origin,
                        'oauth_callback': origin + '/auth/github/callback', 'oauth_client_id': 'qualification-client',
                        'oauth_secret_file': f'{SECRETS}/github', 'tls_cert_file': f'{SECRETS}/tls.crt',
                        'tls_key_file': f'{SECRETS}/tls.key'},
            'identities': {'uid_min': POOL[0], 'uid_max': POOL[1], 'admission': [s for s, _ in PEOPLE],
                           'administrators': [PEOPLE[0][0]]},
            'storage': {'home_uuid': self.obs['home_uuid'], 'filesystem': 'ext4', 'enforce_user_quota': True,
                        'default_limit_bytes': DEFAULT_LIMIT},
            'profiles': self.spec['profiles'],
        }
        if 'editor' in self.spec['profiles']:
            self.site['editor'] = {'origin_template': EDITOR_TEMPLATE}
        self.write_site()
        self.cli(self.bin, 'host', 'config', 'show', '--site', SITE, '--json')
        return {'binary': self.bin, 'profiles': self.spec['profiles']}

    def prepare(self):
        plan = self.dry_run(self.bin, 'prepare')
        result = self.live(self.bin, 'prepare', plan['plan_id'])
        if result.get('outcome') != 'prepared':
            raise Failure('prepare_outcome_unexpected', f'prepare returned {result.get("outcome")}')
        return {'plan_id': plan['plan_id'], 'outcome': 'prepared'}

    def apply(self):
        plan = self.dry_run(self.bin, 'apply')
        stale = self.r.stream([self.bin, *self.flags('apply', '0' * 64)])
        stale.stdout.readline()
        lines = stale.stdout.read().splitlines()
        stale.wait()
        stale_code = json.loads(lines[-1]).get('code') if lines else None
        if stale_code != 'stale_plan':
            raise Failure('stale_plan_not_refused', f'a wrong approval returned {stale_code}')
        obs = {'plan_id': plan['plan_id'], 'stale_refused': True}
        if self.interrupt:
            obs['interrupted'] = self.live(self.bin, 'apply', plan['plan_id'], interrupt_at='converging')['interrupted_at']
        result = self.live(self.bin, 'apply', plan['plan_id'])
        if result.get('outcome') != 'applied':
            raise Failure('apply_outcome_unexpected', f'apply returned {result.get("outcome")}')
        if self.live(self.bin, 'apply', plan['plan_id']).get('outcome') != 'no_change':
            raise Failure('apply_repeat_changed', 'an exact repeat of the approved apply was not no_change')
        self.check(self.bin)
        obs.update(outcome='applied', administrators=result.get('administrators'), repeat='no_change',
                   public_https=self.public())
        return obs

    def first_use(self):
        uids = [self.probe('ensure', s, n, str(GATEWAY), str(GATEWAY), str(DEFAULT_LIMIT))['uid'] for s, n in PEOPLE]
        agents = self.people()
        self.cli(self.bin, 'admin', 'storage', 'update', PEOPLE[1][0], '--limit-bytes', str(OVERRIDE_LIMIT), '--json')
        plan = self.dry_run(self.bin, 'apply')
        result = self.live(self.bin, 'apply', plan['plan_id'])
        granted = result.get('administrators') == [{'subject': PEOPLE[0][0], 'outcome': 'granted'}]
        if not granted:
            raise Failure('administrator_not_granted', 'bound administrator was not granted on apply', {'result': result.get('administrators')})
        self.quotas()
        self.obs['state'] = {n: self.probe('state', n, 'write')['sha256'] for _, n in PEOPLE}
        return {'uids': uids, 'agents': agents, 'administrator_granted': True, 'quota_override': OVERRIDE_LIMIT,
                'integrations': self.integrations()}

    def quotas(self, binary=None):
        data = json.loads(self.cli(binary or self.bin, 'admin', 'storage', 'list', '--json').stdout)['data']
        got = {u['id']: u['limit_bytes'] for u in data['users'] if not u.get('unavailable')}
        want = {PEOPLE[0][0]: DEFAULT_LIMIT, PEOPLE[1][0]: OVERRIDE_LIMIT}
        if got != want:
            raise Failure('quota_readback_mismatch', f'quota readback {got} differs from {want}')
        return got

    def healthy(self, binary):
        self.probe('units', 'open-habitat-proc.service', 'open-habitat-broker.service', 'open-habitat-gateway.service')
        self.check(binary)
        status = self.public()
        agents = self.people()
        self.quotas(binary)
        state = {n: self.probe('state', n, 'read')['sha256'] for _, n in PEOPLE}
        if state != self.obs['state']:
            raise Failure('native_state_changed', 'per-person home state changed')
        return {'public_https': status, 'agents': agents, 'native_state_preserved': True,
                'integrations': self.integrations()}

    def reboot_installed(self):
        boot = self.reboot()
        obs = self.healthy(self.bin)
        plan = self.dry_run(self.bin, 'apply')
        obs['apply_after_boot'] = self.live(self.bin, 'apply', plan['plan_id']).get('outcome')
        if obs['apply_after_boot'] != 'no_change':
            raise Failure('apply_after_boot_changed', 'apply after a cold boot was not no_change')
        return {'boot_id': boot, **obs}

    def upgrade(self):
        succ = self.spec['successor']
        app = self.probe('add-app')
        self.obs['integrations_config_sha256'] = app['sha256']
        self.obs['integrations_expected']['dropbox'] = [True, None]
        package = self.put_package(succ)
        self.put_release(succ)
        self.site['release'] = {'version': succ['version'], 'manifest_sha256': succ['manifest_sha256']}
        self.write_site()
        plan = self.dry_run(package, 'upgrade')
        owner = plan['owner_binary']
        staged = self.live(package, 'upgrade', plan['plan_id'])
        if staged.get('outcome') != 'staged':
            raise Failure('upgrade_not_staged', f'first upgrade invocation returned {staged.get("outcome")}')
        obs = {'plan_id': plan['plan_id'], 'owner_binary': owner}
        if self.interrupt:
            # Writer dies while switching; a cold boot must keep public entry closed.
            self.live(owner, 'upgrade', plan['plan_id'], interrupt_at='activating')
            obs['fenced_boot_id'] = self.reboot()
            # SSH can answer before the gateway starts; let boot jobs settle, then
            # sample a window so a gateway that opens late is still caught.
            self.r.run(['systemctl', 'is-system-running', '--wait'], check=False, timeout=600)
            statuses = []
            for _ in range(10):
                statuses.append(self.https(self.t['host'], TLS_NAME, self.tls['ca']))
                if statuses[-1] == 200:
                    raise Failure('fenced_entry_open', 'public HTTPS served 200 after an interrupted upgrade boot')
                self.r.sleep(3)
            obs['fenced_public_statuses'] = sorted(set(statuses), key=str)
        result = self.live(owner, 'upgrade', plan['plan_id'])
        if result.get('outcome') != 'upgraded':
            raise Failure('upgrade_outcome_unexpected', f'upgrade returned {result.get("outcome")}')
        if self.live(owner, 'upgrade', plan['plan_id']).get('outcome') != 'no_change':
            raise Failure('upgrade_repeat_changed', 'an exact repeat of the accepted upgrade was not no_change')
        self.bin = owner
        exe = self.probe('gateway-exe')
        if exe['sha256'] != succ['binary_sha256']:
            raise Failure('gateway_not_successor', 'running gateway executable is not the successor binary')
        obs.update(outcome='upgraded', gateway_exe_sha256=exe['sha256'], **self.healthy(owner))
        return obs

    def reboot_upgraded(self):
        boot = self.reboot()
        obs = self.healthy(self.bin)
        exe = self.probe('gateway-exe')
        if exe['sha256'] != self.spec['successor']['binary_sha256']:
            raise Failure('gateway_not_successor', 'gateway executable after reboot is not the successor binary')
        return {'boot_id': boot, 'gateway_exe_sha256': exe['sha256'], **obs}

    def execute(self):
        failure = None
        for name in stages(self.spec):
            self.emit(event='progress', stage=name, status='started')
            started = time.monotonic()
            entry = {'name': name, 'started': now()}
            try:
                entry['observations'] = getattr(self, name)()
            except Failure as e:
                failure = e
            except (OSError, ValueError, KeyError, TypeError, IndexError, subprocess.SubprocessError) as e:
                failure = Failure('stage_error', f'{name} stopped on {type(e).__name__}: {e}')
            if failure:
                entry.update(status='failed', code=failure.code, message=failure.message)
                if failure.detail:
                    entry['detail'] = failure.detail
            else:
                entry['status'] = 'passed'
            entry['duration_seconds'] = round(time.monotonic() - started, 1)
            self.stages.append(entry)
            self.emit(event='progress', stage=name, status=entry['status'])
            if failure:
                break
        return failure


def harness_identity():
    # Taken when inputs are read, so an edit during a long run is not credited to it.
    repo = Path(__file__).resolve().parent.parent
    def git(*a):
        try:
            p = subprocess.run(['git', '-C', str(repo), *a], capture_output=True, text=True)
        except OSError:
            return None
        return p.stdout.strip() if p.returncode == 0 else None
    return {'commit': git('rev-parse', 'HEAD'), 'dirty': bool(git('status', '--porcelain'))}


def receipt(spec, target, q, failure, extra=None):
    data = {
        'status': 'failed' if failure else 'passed',
        'harness': spec.get('harness') or harness_identity(),
        'target': {k: target[k] for k in ('host', 'port', 'user', 'home_device')},
        'inputs': {k: ({f: v[f] for f in ('version', 'manifest_sha256', 'package', 'package_sha256', 'binary_sha256', 'profiles')} if v else None)
                   for k, v in (('predecessor', spec['predecessor']), ('successor', spec['successor']))},
        'release_key_sha256': spec['release_key_sha256'],
        'profiles': spec['profiles'],
        'stages': q.stages,
        'not_covered': NOT_COVERED + ([] if spec['successor'] else ['upgrade (no successor release supplied)']),
    }
    if failure:
        data['failed_stage'] = q.stages[-1]['name'] if q.stages else None
    if extra:
        data.update(extra)
    return data


# ---------------------------------------------------------------- commands

def emit_jsonl(event):
    print(json.dumps(event, sort_keys=True), file=sys.stderr, flush=True)


def qualify(spec, target, interrupt, transport=None, https=None, log=emit_jsonl):
    with tempfile.TemporaryDirectory(prefix='oh-qualify-', dir='/var/tmp') as private:
        os.chmod(private, 0o700)
        try:
            tls = make_tls(private)
        except (OSError, subprocess.CalledProcessError) as e:
            raise Failure('tls_fixture_failed', f'could not create the per-run CA and leaf with openssl: {e}') from None
        q = Qualification(spec, target, transport or SSH(target, private), https or https_status, tls, log, interrupt)
        failure = q.execute()
        return q, failure


def write_receipt(path, doc):
    if not path:
        return
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(doc, f, indent=2, sort_keys=True)
        f.write('\n')


def operator_call(operator, *args, timeout=1800):
    # Own session: a terminal Ctrl-C must not reach the operator mid-deletion.
    p = subprocess.run([operator, *args, '--json'], capture_output=True, text=True, timeout=timeout, start_new_session=True)
    try:
        doc = json.loads(p.stdout) if p.stdout.strip() else json.loads(p.stderr)
    except ValueError:
        doc = {}
    if p.returncode != 0 or 'data' not in doc:
        err = doc.get('error') or {}
        raise Failure('qualification_vm_operator_failed', f'{os.path.basename(operator)} {args[0]} failed: {err.get("code", "exit " + str(p.returncode))}',
                      {'error': err, 'stderr': tail(p.stderr, 1024)})
    return doc['data']


def cmd_run(args, spec):
    operator = args.operator or shutil.which(OPERATOR)
    if not operator or not os.access(operator, os.X_OK):
        raise Failure('qualification_vm_operator_missing',
                      f'{OPERATOR} is not installed. It is the Fleetrepo operator that creates and destroys the short-lived '
                      'Hetzner qualification VM; install it through the Fleetrepo fleet, pass --operator PATH, or provision '
                      'a stock Ubuntu 24.04 VM yourself and use `cloud-qualify.py target --target FILE`.')
    run_id = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dt%H%M%S') + '-' + secrets.token_hex(3)
    with tempfile.TemporaryDirectory(prefix='oh-qualify-key-', dir='/var/tmp') as keys:
        os.chmod(keys, 0o700)
        key = Path(keys) / 'id_ed25519'
        subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', 'open-habitat-qualification-' + run_id, '-f', str(key)], check=True)
        vm, q, failure, destroyed = None, None, None, None
        target = {'host': None, 'port': 22, 'user': 'root', 'home_device': None}
        try:
            create = ['create', '--run-id', run_id, '--ssh-public-key', str(key) + '.pub', '--ttl-minutes', str(args.ttl_minutes)]
            if args.server_type:
                create += ['--server-type', args.server_type]
            if args.location:
                create += ['--location', args.location]
            vm = operator_call(operator, *create)
            target = {'host': vm['ipv4'], 'port': vm['ssh']['port'], 'user': vm['ssh']['user'],
                      'identity_file': str(key), 'known_hosts': vm['ssh']['known_hosts'],
                      'home_device': vm['volume']['device'], 'expect_apt_mirror': args.expect_apt_mirror}
            q, failure = qualify(spec, target, not args.no_interrupt)
        except Failure as e:
            failure = e
        finally:
            if failure and args.keep_on_failure and vm:
                destroyed = {'kept': True, 'expires_at': vm.get('expires_at')}
            else:
                # Hold SIGINT/SIGTERM until deletion finishes; they are delivered
                # (and exit 130/143) once the mask is restored.
                mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGINT, signal.SIGTERM})
                try:
                    destroyed = operator_call(operator, 'destroy', '--run-id', run_id)
                except (Failure, OSError, subprocess.TimeoutExpired) as e:
                    destroyed = {'error': getattr(e, 'code', 'qualification_vm_destroy_failed'),
                                 'message': str(e), 'server_may_remain': True, 'run_id': run_id}
                finally:
                    signal.pthread_sigmask(signal.SIG_SETMASK, mask)
        if destroyed and destroyed.get('server_may_remain') and not failure:
            failure = Failure('qualification_vm_destroy_failed', f'qualification passed but run {run_id} could not be destroyed; its TTL reaper must remove it')
        vm_info = {'run_id': run_id, 'server': (vm or {}).get('server'), 'expires_at': (vm or {}).get('expires_at'), 'teardown': destroyed}
        if q is None:
            raise Failure(failure.code, failure.message, {'vm': vm_info, **({'detail': failure.detail} if failure.detail else {})})
        return receipt(spec, target, q, failure, {'vm': vm_info}), failure


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise Usage('usage_invalid', message)


def parser():
    p = Parser(prog='cloud-qualify.py', description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter,
                                epilog='Exit codes: 0 passed or valid plan; 1 qualification or infrastructure failure; '
                                       '2 usage or invalid input; 130/143 interrupted (run still destroys its VM).')
    sub = p.add_subparsers(dest='command', required=True, parser_class=Parser)
    for name, help_text in (('plan', 'validate release inputs offline and print the stage plan'),
                            ('target', 'qualify on an existing freshly booted stock VM'),
                            ('run', 'provision a short-lived VM through Fleetrepo, qualify, destroy')):
        s = sub.add_parser(name, help=help_text)
        s.add_argument('--predecessor', required=True, help='directory with one published release: product package, release.json, release.sig, archives')
        s.add_argument('--successor', help='directory with the next release whose manifest names the predecessor; enables upgrade stages')
        s.add_argument('--release-key', required=True, help='independently trusted raw 32-byte Ed25519 release public key')
        s.add_argument('--profiles', help='comma-separated profiles to install (default: every profile the predecessor ships)')
        s.add_argument('--json', action='store_true', help='print the result document as JSON')
        if name != 'plan':
            s.add_argument('--receipt', help='also write the result document to this new file (never overwritten)')
            s.add_argument('--no-interrupt', action='store_true', help='skip the SIGKILL interruption/continuation of apply and upgrade')
        if name == 'target':
            s.add_argument('--target', required=True, help='target JSON: host, port, user, identity_file, known_hosts, home_device[, expect_apt_mirror]')
        if name == 'run':
            s.add_argument('--operator', help=f'path to the Fleetrepo operator (default: {OPERATOR} on PATH)')
            s.add_argument('--server-type', help='operator-allowlisted server type (operator default when omitted)')
            s.add_argument('--location', help='operator-allowlisted location (operator default when omitted)')
            s.add_argument('--ttl-minutes', type=int, default=180, help='expiry after which the operator reaps the VM even if this process dies (default 180)')
            s.add_argument('--keep-on-failure', action='store_true', help='leave a failed VM for diagnosis until its TTL expires')
            s.add_argument('--expect-apt-mirror', default='mirror.hetzner.com', help='apt host the stock image must use (default mirror.hetzner.com)')
    return p


def main(argv=None):
    def interrupted(signum, frame):
        raise SystemExit(128 + signum)
    signal.signal(signal.SIGTERM, interrupted)
    args = None
    try:
        args = parser().parse_args(argv)
        if getattr(args, 'receipt', None) and os.path.lexists(args.receipt):
            raise Usage('receipt_exists', f'{args.receipt} already exists; receipts are never overwritten')
        spec = inputs(args)
        if args.command != 'plan':
            spec['harness'] = harness_identity()
        if args.command == 'plan':
            doc = {'schema_version': SCHEMA, 'data': {'status': 'planned', 'stages': stages(spec), 'profiles': spec['profiles'],
                   'predecessor': {k: spec['predecessor'][k] for k in ('version', 'manifest_sha256', 'package_sha256', 'binary_sha256')},
                   'successor': {k: spec['successor'][k] for k in ('version', 'manifest_sha256', 'package_sha256', 'binary_sha256')} if spec['successor'] else None,
                   'not_covered': NOT_COVERED}, 'warnings': []}
            failure = None
        elif args.command == 'target':
            target = load_target(args.target)
            q, failure = qualify(spec, target, not args.no_interrupt)
            doc = {'schema_version': SCHEMA, 'data': receipt(spec, target, q, failure), 'warnings': []}
        else:
            data, failure = cmd_run(args, spec)
            doc = {'schema_version': SCHEMA, 'data': data, 'warnings': []}
        if args.command != 'plan':
            write_receipt(args.receipt, doc)
        if args.json:
            print(json.dumps(doc, sort_keys=True))
        else:
            d = doc['data']
            steps = [s if isinstance(s, str) else s['name'] + '=' + s['status'] for s in d.get('stages', [])]
            print(d['status'] + ': ' + ' '.join(steps))
        return 1 if failure else 0
    except KeyboardInterrupt:
        return 130
    except Failure as e:
        err = {'code': e.code, 'message': e.message}
        if e.detail:
            err['detail'] = e.detail
        print(json.dumps({'schema_version': SCHEMA, 'error': err}, sort_keys=True), file=sys.stderr)
        return 2 if isinstance(e, Usage) else 1


if __name__ == '__main__':
    sys.exit(main())
