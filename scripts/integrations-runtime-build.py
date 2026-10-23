#!/usr/bin/env python3
"""Seal the pinned Microsoft native tools, adapter and Node as one closure."""
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import tarfile

spec = importlib.util.spec_from_file_location('profiles', Path(__file__).with_name('profile-runtime-build.py'))
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)


def build(inputs, installed, node_archive, out):
    lock = json.loads((inputs / 'artifact-lock.json').read_text())
    if profiles.digest(node_archive) != lock['node']['sha256']:
        raise ValueError('Node digest mismatch')
    npm = json.loads((inputs / 'package-lock.json').read_text())
    if (installed / 'package-lock.json').read_bytes() != (inputs / 'package-lock.json').read_bytes():
        raise ValueError('npm lock mismatch')
    out.mkdir(mode=0o700)
    root = out / 'payload'
    root.mkdir()
    owners, components = {}, []

    def put(src, dest, owner, executable=False):
        target = root / dest
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, target)
        target.chmod(0o755 if executable else 0o644)
        owners[dest] = owner

    extracted = out / 'extract'
    with tarfile.open(node_archive) as archive:
        archive.extractall(extracted, filter='data')
    node = extracted / lock['node']['prefix']
    put(node / 'bin/node', 'runtime/bin/node', 'node', True)
    put(node / 'LICENSE', 'licenses/node.txt', 'node')
    components.append(dict(name='node', version=lock['node']['version'], kind='node', license_files=['licenses/node.txt']))
    # This closure targets Linux/x64/glibc. An applicable optional dependency is
    # still part of the lock, even when it is never loaded (e.g. keytar).
    def matches(values, target):
        return not values or ('!' + target not in values and (all(v.startswith('!') for v in values) or target in values))
    for rel, expected in sorted(npm['packages'].items()):
        if not rel or not all(matches(expected.get(key), value) for key, value in [('os', 'linux'), ('cpu', 'x64'), ('libc', 'glibc')]):
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
            put(p, dest, owner, bool(p.stat().st_mode & 0o111))
            if p.parent == source and p.name.lower().startswith(('license', 'licence', 'notice', 'copying')):
                licenses.append(dest)
        if not licenses:
            if not meta.get('license') or meta['license'] == 'UNLICENSED':
                raise ValueError('license_unverified: ' + rel)
            licenses = ['runtime/' + rel + '/package.json']
        components.append(dict(name=owner, version=meta['version'], kind='npm', license_files=licenses))
    for name in ['package.json', 'package-lock.json']:
        put(inputs / name, 'runtime/' + name, 'npm-lock')
    components.append(dict(name='npm-lock', version='1.0.0', kind='lock', license_files=['runtime/package.json']))
    for name in ['microsoft-native.mjs', 'microsoft-native-cli.mjs', 'artifact-lock.json', 'NOTICE']:
        put(inputs / name, 'runtime/' + name, 'microsoft-native')
    for name, entry in [('microsoft-native', 'microsoft-native-cli.mjs'), ('ms-365-mcp-server', 'node_modules/@softeria/ms-365-mcp-server/dist/index.js')]:
        dest = 'runtime/bin/' + name
        target = root / dest
        target.write_text('#!/bin/sh\nhere=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$here/node" "$here/../' + entry + '" "$@"\n')
        target.chmod(0o755)
        owners[dest] = 'microsoft-native'
    components.append(dict(name='microsoft-native', version='1.0.0', kind='native', license_files=['runtime/NOTICE']))
    profiles.seal(root, out, 'integrations', owners, components, [])
    shutil.rmtree(extracted)


if __name__ == '__main__':
    build(*(Path(p) for p in sys.argv[1:]))
