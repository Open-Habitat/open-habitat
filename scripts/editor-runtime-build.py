#!/usr/bin/env python3
"""Normalize the upstream editor tree to the authenticated link-free format."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tarfile

spec = importlib.util.spec_from_file_location('profiles', Path(__file__).with_name('profile-runtime-build.py'))
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)


def build(lock_path, archive, out, target):
    lock = json.loads(lock_path.read_text())
    pin = profiles.target_pin(lock, target)
    if profiles.digest(archive) != pin['sha256']:
        raise ValueError('editor digest mismatch')
    out.mkdir(mode=0o700)
    extracted = out / 'extract'
    extracted.mkdir()
    with tarfile.open(archive) as tar:
        tar.extractall(extracted, filter='data')
    source = extracted / pin['prefix']
    root = out / 'payload'
    root.mkdir()
    owners = {}
    for p in sorted(source.rglob('*')):
        resolved = p.resolve()
        if not resolved.is_relative_to(source.resolve()):
            raise ValueError('editor link escapes upstream tree')
        if p.is_dir():
            if p.is_symlink():
                raise ValueError('directory alias requires explicit normalization')
            continue
        if not resolved.is_file():
            raise ValueError('editor special member')
        dest = root / 'runtime' / p.relative_to(source)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if p.is_symlink() and resolved.stat().st_mode & 0o111:
            # Copying a JS .bin symlink changes relative-import resolution.
            # Invoke the real target with this editor's own Node instead.
            target = os.path.relpath(resolved, p.parent)
            with resolved.open('rb') as f:
                shebang = f.readline(256)
            node_script = b'node' in shebang and shebang.startswith(b'#!')
            node = os.path.relpath(source / 'lib/node', p.parent)
            if any(c in target + node for c in ('\\', '"', '`', '$', '\n', '\r')):
                raise ValueError('unsupported executable alias path')
            command = '"$here/' + node + '" ' if node_script else ''
            dest.write_text('#!/bin/sh\nhere=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec ' + command + '"$here/' + target + '" "$@"\n')
        else:
            shutil.copyfile(resolved, dest)
        dest.chmod(0o755 if resolved.stat().st_mode & 0o111 else 0o644)
        owners[dest.relative_to(root).as_posix()] = lock['name']
    licenses = ['runtime/' + p for p in lock['licenses']]
    for p in licenses:
        if not (root / p).is_file() or (root / p).stat().st_size == 0:
            raise ValueError('license_unverified')
    # Retain source identity alongside the exact normalized file inventory.
    shutil.copyfile(lock_path, root / 'artifact-lock.json')
    (root / 'artifact-lock.json').chmod(0o644)
    owners['artifact-lock.json'] = lock['name']
    components = [dict(name=lock['name'], version=lock['version'], kind='native', license_files=licenses)]
    profiles.seal(root, out, lock['profile'], owners, components, [])
    shutil.rmtree(extracted)
    shutil.rmtree(root)


if __name__ == '__main__':
    build(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4])
