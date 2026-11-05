#!/usr/bin/env python3
"""Carry the core runtime's released Rust tools: Taskfleet and its workmux.

Each tool is the upstream release binary for the target, pinned by digest in
runtime/core/artifact-lock.json together with its LICENSE, the Cargo.lock it
was released from and every locked crate. The build checks that the crate list
is exactly the Cargo.lock's, that each crate archive declares the locked SPDX
licence in its own Cargo.toml, and that the licence is one the product may
ship, then retains each crate's licence records beside the binary.
"""
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile
import tomllib
import urllib.request

# Licences a shipped binary may carry. An expression passes when some choice
# among its OR alternatives uses only these; copyleft may appear only as an
# alternative never chosen.
ALLOWED = {
    '0BSD', 'Apache-2.0', 'Apache-2.0 WITH LLVM-exception', 'BSD-2-Clause',
    'BSD-3-Clause', 'BSL-1.0', 'CC0-1.0', 'ISC', 'MIT', 'Unicode-3.0',
    'Unicode-DFS-2016', 'Unlicense', 'WTFPL', 'Zlib',
}
NOTICE = re.compile(r'(?i)^(licen[cs]e|copying|notice|patents|unlicense|copyright)([._-].*)?$')
REGISTRY = 'registry+https://github.com/rust-lang/crates.io-index'


def licence_allowed(expression):
    """Evaluate an SPDX expression (also the legacy '/' form) against ALLOWED."""
    tokens = re.findall(r'\(|\)|[A-Za-z0-9.+-]+', expression.replace('/', ' OR '))
    pos = 0

    def peek():
        return tokens[pos] if pos < len(tokens) else None

    def take():
        nonlocal pos
        pos += 1
        return tokens[pos - 1]

    def primary():
        if peek() == '(':
            take()
            value = disjunction()
            if take() != ')':
                raise ValueError
            return value
        name = take()
        if name in ('AND', 'OR', 'WITH', ')'):
            raise ValueError
        if peek() == 'WITH':
            take()
            name += ' WITH ' + take()
        return name in ALLOWED

    def conjunction():
        value = primary()
        while peek() == 'AND':
            take()
            value = primary() and value
        return value

    def disjunction():
        value = conjunction()
        while peek() == 'OR':
            take()
            value = conjunction() or value
        return value

    try:
        result = bool(tokens) and disjunction()
        return result and pos == len(tokens)
    except (ValueError, IndexError):
        return False


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fetch(url, sha256):
    with urllib.request.urlopen(url, timeout=300) as r:
        data = r.read()
    if digest(data) != sha256:
        raise ValueError('locked digest mismatch: ' + url)
    return data


def binary(archive, member):
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        f = tar.getmember(member)
        if not f.isfile():
            raise ValueError('regular release binary required: ' + member)
        return tar.extractfile(f).read()


def notices(archive, prefix):
    """Licence records and the manifest from one crate archive, by relative path."""
    out = {}
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for f in tar:
            name = PurePosixPath(f.name)
            if not f.isfile() or name.is_absolute() or '..' in name.parts or name.parts[0] != prefix:
                continue
            rel = PurePosixPath(*name.parts[1:])
            if rel.as_posix() == 'Cargo.toml' or NOTICE.match(rel.name) and len(rel.parts) <= 2:
                out[rel.as_posix()] = tar.extractfile(f).read()
    if 'Cargo.toml' not in out:
        raise ValueError('crate manifest missing: ' + prefix)
    return out


def check_crates(tool, cargo_lock):
    """The locked crate list must be exactly the release's Cargo.lock."""
    lock = tomllib.loads(cargo_lock.decode())
    registry = {(p['name'], p['version'], p['checksum']) for p in lock['package'] if p.get('source') == REGISTRY}
    git = {(p['name'], p['version'], p['source']) for p in lock['package'] if p.get('source', '').startswith('git+')}
    other = [p for p in lock['package'] if p.get('source') and p['source'] != REGISTRY and not p['source'].startswith('git+')]
    if other or registry != {(c['name'], c['version'], c['sha256']) for c in tool['crates']} or len(registry) != len(tool['crates']) \
            or git != {(c['name'], c['version'], c['source']) for c in tool['git_crates']} or len(git) != len(tool['git_crates']):
        raise ValueError('incomplete Rust source lock: ' + tool['name'])


def add_tool(tool, target, put_bytes, fetcher=fetch):
    """Place one tool's binary and licence records; return its licence files."""
    pin = tool['targets'][target]
    name = tool['name']
    if set(tool['targets']) != {'linux-amd64', 'linux-arm64'}:
        raise ValueError('lock must pin every target: ' + name)
    put_bytes(binary(fetcher(pin['url'], pin['sha256']), pin['member']), 'runtime/agent-bin/' + name, name, True)
    files = {f['filename']: fetcher(f['url'], f['sha256']) for f in tool['files']}
    if set(files) != {'LICENSE', 'Cargo.lock'} or not files['LICENSE'].strip():
        raise ValueError('tool licence or Cargo.lock missing: ' + name)
    check_crates(tool, files['Cargo.lock'])
    base = 'licenses/' + name + '/'
    licences = []
    for filename, data in files.items():
        put_bytes(data, base + filename, name)
    licences.append(base + 'LICENSE')
    for c in tool['crates'] + tool['git_crates']:
        if not licence_allowed(c['license']):
            raise ValueError('license_unverified: ' + c['name'] + ' ' + c['license'])
        if 'files' in c:
            retained = {f['filename']: fetcher(f['url'], f['sha256']) for f in c['files']}
        else:
            retained = notices(fetcher(c['url'], c['sha256']), c['name'] + '-' + c['version'])
        if tomllib.loads(retained['Cargo.toml'].decode())['package'].get('license') != c['license']:
            raise ValueError('crate licence declaration mismatch: ' + c['name'])
        # Cargo.toml carries the SPDX declaration where a crate ships no text.
        for rel, data in sorted(retained.items()):
            path = base + 'crates/' + c['name'] + '-' + c['version'] + '/' + rel
            put_bytes(data, path, name)
            licences.append(path)
    return licences


def check_executables(root, lock):
    """The placed binaries report exactly the locked versions; return Taskfleet's skills catalog."""
    by_name = {t['name']: t for t in lock['tools']}
    tf = by_name['taskfleet']
    info = json.loads(subprocess.run([str(root / 'runtime/agent-bin/taskfleet'), 'version', '--output', 'json'], check=True, capture_output=True, env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent'}).stdout)['data']
    if info['version'] != tf['version'] or info['commit'] != tf['commit'] or not info['skills'] or any(s['cli_version'] != tf['version'] for s in info['skills']):
        raise ValueError('taskfleet executable disagrees with its lock')
    wm = subprocess.run([str(root / 'runtime/agent-bin/workmux'), '--version'], check=True, capture_output=True, env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent'}).stdout.decode().split()
    if wm != ['workmux', by_name['workmux']['version']]:
        raise ValueError('workmux executable disagrees with its lock')
    return sorted(s['name'] for s in info['skills'])


def install_skills(root, scratch, names):
    """Write Taskfleet's bundled Pi skills from the pinned binary itself."""
    home = scratch / 'home'
    home.mkdir(mode=0o700)
    target = scratch / 'skills'
    subprocess.run([str(root / 'runtime/agent-bin/taskfleet'), 'skill', 'install', '--agent', 'pi', '--target', str(target), '--output', 'json'], check=True, capture_output=True,
                   env={'PATH': '/usr/bin:/bin', 'HOME': str(home), 'TASKFLEET_HOME': str(home / '.taskfleet')})
    written = target / '.pi/agent/skills'
    if sorted(p.name for p in written.iterdir()) != names:
        raise ValueError('taskfleet skills disagree with its catalog')
    return written


def add_tools(lock, target, root, scratch, put_bytes, components):
    for tool in lock['tools']:
        licences = add_tool(tool, target, put_bytes)
        components.append(dict(name=tool['name'], version=tool['version'], kind='native', license_files=licences))
    names = check_executables(root, lock)
    skills = install_skills(root, scratch, names)
    for p in sorted(skills.rglob('*')):
        if p.is_symlink() or not (p.is_file() or p.is_dir()):
            raise ValueError('unexpected skill entry')
        if p.is_file():
            put_bytes(p.read_bytes(), 'runtime/taskfleet/skills/' + p.relative_to(skills).as_posix(), 'taskfleet')
