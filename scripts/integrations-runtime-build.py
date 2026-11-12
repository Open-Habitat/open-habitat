#!/usr/bin/env python3
"""Seal the integration tools every installation ships as one closure.

Native binaries (himalaya, rclone, gog, tea) come from their upstream release
archives and the Microsoft tools from the locked npm tree with their own Node.
Every input is pinned by digest in artifact-lock.json, per release target where
upstream builds per architecture; nothing is resolved here.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys
import tarfile
import zipfile

spec = importlib.util.spec_from_file_location('profiles', Path(__file__).with_name('profile-runtime-build.py'))
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)
spec = importlib.util.spec_from_file_location('go_notices', Path(__file__).with_name('go-binary-notices.py'))
go_notices = importlib.util.module_from_spec(spec)
spec.loader.exec_module(go_notices)


# Absolute tool paths are published from this directory by host apply; the Go
# release verifier requires every one of them (internal/host/integrations_linux.go).
PI_WRAPPER = (
    '#!/bin/sh\n'
    '# Pi CLI for native MCP commands and RPC login. Core shares this generation;\n'
    '# -P resolves the stable profile link before walking up to it.\n'
    'core=$(CDPATH= cd -P -- "$(dirname -- "$0")/../../../core/runtime" && pwd -P)\n'
    'exec "$core/bin/node" "$core/node_modules/@earendil-works/pi-coding-agent/{entry}" "$@"\n'
)


def pi_wrapper(core_lock):
    entry = json.loads(core_lock.read_text())['packages']['node_modules/@earendil-works/pi-coding-agent']['bin']['pi']
    if not isinstance(entry, str) or not re.fullmatch(r'[a-zA-Z0-9_./-]+', entry) or entry.startswith('/') or '..' in entry.split('/'):
        raise ValueError('invalid Pi CLI entry')
    return PI_WRAPPER.format(entry=entry).encode()


def add_tools(lock, inputs, put_bytes, components, target):
    """Extract each pinned upstream executable and its licence texts."""
    blobs = {i['filename']: i for i in profiles.for_target(lock['inputs'], target)}
    tools = profiles.for_target(lock['tools'], target)
    if len({t['name'] for t in tools}) != len(tools) or {t['name'] for t in tools} != {t['name'] for t in lock['tools']}:
        raise ValueError('every tool needs exactly one pin per target')
    for tool in tools:
        if not re.fullmatch('[a-z][a-z0-9-]{0,31}', tool['name']) or not tool['license_files']:
            raise ValueError('invalid tool lock')
        # A Go tool's dependency notice is checked in beside this lock and
        # bound to the binary's embedded module list below instead of a digest.
        notices = tool.get('go_notices')
        for name in [tool['archive']] + [n for n in tool['license_files'] if n != notices]:
            if name not in blobs or profiles.digest(inputs / name) != blobs[name]['sha256']:
                raise ValueError('locked input digest mismatch: ' + name)
        archive = inputs / tool['archive']
        if tool['member'] is None:
            # Upstream publishes the executable itself, not an archive.
            data = archive.read_bytes()
        elif archive.name.endswith('.zip'):
            with zipfile.ZipFile(archive) as z:
                data = z.read(tool['member'])
        else:
            with tarfile.open(archive) as t:
                member = t.getmember(tool['member'])
                if not member.isfile():
                    raise ValueError('tool member is not a regular file')
                data = t.extractfile(member).read()
        if hashlib.sha256(data).hexdigest() != tool['sha256']:
            raise ValueError('tool digest mismatch: ' + tool['name'])
        if notices is not None:
            if notices not in tool['license_files']:
                raise ValueError('invalid tool lock')
            go_notices.check((inputs / notices).read_text(), data)
        elif go_notices.is_go(data):
            # A Go executable links its modules in; its top-level licence alone
            # is not the whole notice.
            raise ValueError('go_notices_required: ' + tool['name'])
        put_bytes(data, 'runtime/bin/' + tool['name'], tool['name'], True)
        licenses = []
        for name in tool['license_files']:
            # Inputs are named <project>-<upstream file name>.
            dest = 'licenses/' + tool['name'] + '/' + name.split('-', 1)[1]
            put_bytes((inputs / name).read_bytes(), dest, tool['name'])
            licenses.append(dest)
        components.append(dict(name=tool['name'], version=tool['version'], kind='native', license_files=licenses))


def patch_ms365_scopes(spec, rel, version, data):
    """Return endpoints.json with the scope metadata of the agent's file tools
    rewritten to the Graph permissions the operator's applications hold.

    The pinned server requests exactly the scopes its tool metadata names, and
    a token request naming one the tenant has not consented to fails for every
    tool of the server. Upstream names the narrow Files.Read (and, for
    search-query, chat and people scopes) where the applications hold
    Files.*.All and Sites.*.All, so without this the file tools cannot run at
    all. Each entry must still read exactly as the reviewed upstream bytes did;
    anything else, including a version bump, fails the build. The server
    requests the first group the allowed scopes cover, so ReadWrite.All groups
    come first: a write level must never request a Read.All it does not hold.
    """
    if rel != spec['package'] or version != spec['version']:
        raise ValueError('ms365 scope patch targets another package version')
    endpoints = json.loads(data)
    for name, change in sorted(spec['tools'].items()):
        found = [e for e in endpoints if e.get('toolName') == name]
        if len(found) != 1:
            raise ValueError('ms365 scope patch: tool not unique: ' + name)
        entry = found[0]
        if {k: entry.get(k) for k in change['from']} != change['from'] or set(change['from']) != set(change['to']):
            raise ValueError('ms365 scope patch: upstream metadata changed: ' + name)
        entry.update(change['to'])
    return (json.dumps(endpoints, indent=2) + '\n').encode()


def build(inputs, installed, node_archive, out, target):
    lock = json.loads((inputs / 'artifact-lock.json').read_text())
    packages = profiles.ubuntu_requirements(inputs / 'ubuntu-packages.json', target)
    node_pin = profiles.target_pin(lock['node'], target)
    if profiles.digest(node_archive) != node_pin['sha256']:
        raise ValueError('Node digest mismatch')
    npm = json.loads((inputs / 'package-lock.json').read_text())
    ms365 = json.loads((inputs / 'ms-365-mcp-server-scopes.json').read_text())
    patched = False
    if (installed / 'package-lock.json').read_bytes() != (inputs / 'package-lock.json').read_bytes():
        raise ValueError('npm lock mismatch')
    out.mkdir(mode=0o700)
    root = out / 'payload'
    root.mkdir()
    owners, components = {}, []

    def put(src, dest, owner, executable=False):
        put_bytes(Path(src).read_bytes(), dest, owner, executable)

    def put_bytes(data, dest, owner, executable=False):
        if dest in owners:
            raise ValueError('duplicate payload path: ' + dest)
        target = root / dest
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        target.chmod(0o755 if executable else 0o644)
        owners[dest] = owner

    extracted = out / 'extract'
    with tarfile.open(node_archive) as archive:
        archive.extractall(extracted, filter='data')
    node = extracted / node_pin['prefix']
    put(node / 'bin/node', 'runtime/bin/node', 'node', True)
    put(node / 'LICENSE', 'licenses/node.txt', 'node')
    components.append(dict(name='node', version=lock['node']['version'], kind='node', license_files=['licenses/node.txt']))
    # This closure targets Linux/glibc on the target's CPU (npm spells amd64
    # x64). An applicable optional dependency is still part of the lock, even
    # when it is never loaded (e.g. keytar).
    cpu = {'amd64': 'x64'}.get(profiles.TARGETS[target], profiles.TARGETS[target])
    def matches(values, target):
        return not values or ('!' + target not in values and (all(v.startswith('!') for v in values) or target in values))
    for rel, expected in sorted(npm['packages'].items()):
        if not rel or not all(matches(expected.get(key), value) for key, value in [('os', 'linux'), ('cpu', cpu), ('libc', 'glibc')]):
            continue
        source = installed / rel
        meta = json.loads((source / 'package.json').read_text())
        if meta['version'] != expected['version']:
            raise ValueError('npm identity mismatch: ' + rel)
        owner = 'npm:' + rel
        licenses = []
        for p in sorted(source.rglob('*')):
            if 'node_modules' in p.relative_to(source).parts or p.is_dir():
                continue
            if p.is_symlink() or not p.is_file():
                raise ValueError('unexpected npm link/special file')
            dest = 'runtime/' + p.relative_to(installed).as_posix()
            if rel == ms365['package'] and p.relative_to(source).as_posix() == ms365['file']:
                put_bytes(patch_ms365_scopes(ms365, rel, meta['version'], p.read_bytes()), dest, owner)
                patched = True
                continue
            put(p, dest, owner, bool(p.stat().st_mode & 0o111))
            if p.parent == source and p.name.lower().startswith(('license', 'licence', 'notice', 'copying')):
                licenses.append(dest)
        if not licenses:
            if not meta.get('license') or meta['license'] == 'UNLICENSED':
                raise ValueError('license_unverified: ' + rel)
            licenses = ['runtime/' + rel + '/package.json']
        components.append(dict(name=owner, version=meta['version'], kind='npm', license_files=licenses))
    if not patched:
        raise ValueError('ms365 scope patch: endpoints not found')
    for name in ['package.json', 'package-lock.json', 'ms-365-mcp-server-scopes.json']:
        put(inputs / name, 'runtime/' + name, 'npm-lock')
    components.append(dict(name='npm-lock', version='1.0.0', kind='lock', license_files=['runtime/package.json']))
    add_tools(lock, inputs, put_bytes, components, target)
    put(inputs / 'artifact-lock.json', 'runtime/artifact-lock.json', 'integrations-lock')
    components.append(dict(name='integrations-lock', version='1.0.0', kind='lock', license_files=['runtime/artifact-lock.json']))
    put(inputs / 'ubuntu-packages.json', 'ubuntu-packages.json', 'ubuntu-requirements')
    components.append(dict(name='ubuntu-requirements', version='24.04', kind='lock', license_files=['ubuntu-packages.json']))
    for name in ['microsoft-native.mjs', 'microsoft-native-cli.mjs', 'NOTICE']:
        put(inputs / name, 'runtime/' + name, 'microsoft-native')
    for name, entry in [('microsoft-native', 'microsoft-native-cli.mjs'), ('ms-365-mcp-server', 'node_modules/@softeria/ms-365-mcp-server/dist/index.js')]:
        dest = 'runtime/bin/' + name
        target = root / dest
        target.write_text('#!/bin/sh\nhere=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$here/node" "$here/../' + entry + '" "$@"\n')
        target.chmod(0o755)
        owners[dest] = 'microsoft-native'
    core_lock = Path(__file__).resolve().parent.parent / 'runtime/core/package-lock.json'
    put_bytes(pi_wrapper(core_lock), 'runtime/bin/pi', 'microsoft-native', True)
    components.append(dict(name='microsoft-native', version='1.0.0', kind='native', license_files=['runtime/NOTICE']))
    profiles.seal(root, out, 'integrations', owners, components, packages)
    shutil.rmtree(extracted)


if __name__ == '__main__':
    build(*(Path(p) for p in sys.argv[1:5]), sys.argv[5])
