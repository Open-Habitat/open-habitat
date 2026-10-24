#!/usr/bin/env python3
"""Seal Python beside (never over) system Python, including native sources/notices.

Requires Python 3.14's zstd reader for the upstream full metadata archive.
The install-only tree is normalized to regular files; no upstream code is run.
"""
import ast
import importlib.util
import json
from pathlib import Path, PurePosixPath
import shutil
import sys
import tarfile
import zipfile

spec = importlib.util.spec_from_file_location('profiles', Path(__file__).with_name('profile-runtime-build.py'))
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)


# python-build-standalone names each release target by its LLVM triple.
TRIPLES = {'linux-amd64': 'x86_64-unknown-linux-gnu', 'linux-arm64': 'aarch64-unknown-linux-gnu'}


def build(lock_path, inputs, out, target):
    lock = json.loads(lock_path.read_text())
    selected = profiles.for_target(lock['inputs'], target)
    records = {a['name']: a for a in selected}
    if len(records) != len(selected) or not {'runtime', 'full'} <= records.keys():
        raise ValueError('duplicate input identity')
    for a in records.values():
        if Path(a['filename']).name != a['filename'] or profiles.digest(inputs / a['filename']) != a['sha256']:
            raise ValueError('locked input mismatch: ' + a['name'])
    # Check the selected native sources against the immutable build recipe.
    # Metadata below must also reject a newly referenced but unlocked library.
    build_source = records['build-source']
    prefix = 'python-build-standalone-' + build_source['version'] + '/'
    with tarfile.open(inputs / build_source['filename']) as tar:
        tree = ast.parse(tar.extractfile(prefix + 'pythonbuild/downloads.py').read())
    downloads = ast.literal_eval(next(n.value for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'DOWNLOADS' for t in n.targets)))
    sources = {'bdb', 'bzip2', 'cpython-3.14', 'expat', 'libedit', 'libffi', 'libX11', 'libXau', 'libxcb', 'mpdecimal', 'ncurses', 'openssl-1.1', 'openssl-3.5', 'sqlite', 'tcl', 'tk', 'uuid', 'xz', 'zlib', 'zlib-ng', 'zstd'}
    for name in sources:
        for field in ('sha256', 'version', 'url', 'license_file'):
            if records[name][field] != downloads[name][field]:
                raise ValueError('native source disagrees with upstream recipe: ' + name)
    out.mkdir(mode=0o700)
    root = out / 'payload'
    root.mkdir()
    owners = {}
    notices = {'cpython': []}
    versions = {'cpython': lock['version']}

    def put(data, path, executable=False, owner='cpython'):
        name = PurePosixPath(path)
        if name.is_absolute() or '..' in name.parts or path in owners:
            raise ValueError('unsafe or duplicate payload path')
        dest = root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        dest.chmod(0o755 if executable else 0o644)
        owners[path] = owner
        return path

    with tarfile.open(inputs / records['full']['filename']) as tar:
        metadata = tar.extractfile('python/PYTHON.json').read()
        meta = json.loads(metadata)
        if meta['python_version'] != '3.14.4' or meta['target_triple'] != TRIPLES[target]:
            raise ValueError('wrong Python target')
        required = {meta['license_path']}
        def walk(value):
            if isinstance(value, dict):
                required.update(value.get('license_paths', []))
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)
        walk(meta['build_info'])
        locked_notices = {'licenses/' + a['license_file'] for a in records.values() if a.get('license_file')}
        if not required.issubset(locked_notices):
            raise ValueError('upstream references an unlocked native source: ' + str(required - locked_notices))
        put(metadata, 'PYTHON.json')
        # Retain every full-build licence, not only those referenced by modules.
        for member in tar:
            if member.isfile() and member.name.startswith('python/licenses/'):
                path = member.name.removeprefix('python/')
                data = tar.extractfile(member).read()
                if not data:
                    raise ValueError('empty Python notice')
                notices['cpython'].append(put(data, path))
    # Source plus the matching build scripts/patches travel with the binaries.
    # This also supplies DB's complete-source requirement, not just its notice.
    for a in records.values():
        if a['name'] in ('runtime', 'full'):
            continue
        source = inputs / a['filename']
        owner = 'cpython' if a['name'] == 'cpython-3.14' else a['name']
        if owner != 'cpython':
            versions[owner] = a['version']
        notices.setdefault(owner, [])
        if a.get('kind') == 'wheel':
            put(source.read_bytes(), 'qualification/wheels/' + source.name, owner=owner)
            with zipfile.ZipFile(source) as wheel:
                found = []
                for name in wheel.namelist():
                    if '.dist-info/' in name and ('license' in name.lower() or name.rsplit('/', 1)[-1] == 'COPYING') and not name.endswith('/'):
                        data = wheel.read(name)
                        if data:
                            found.append(put(data, 'licenses/wheels/' + a['name'] + '/' + name, owner=owner))
                if not found:
                    raise ValueError('wheel licence missing')
                notices[owner].extend(found)
        else:
            put(source.read_bytes(), 'sources/' + source.name, owner=owner)
        if a.get('supplemental_notice'):
            with tarfile.open(source) as tar:
                data = tar.extractfile(a['supplemental_notice']).read()
                if not data:
                    raise ValueError('empty supplemental notice')
                notices['cpython'].append(put(data, 'licenses/' + a['license_file']))
    # Root notices retain PYTHON.json's paths; copies give each independently
    # versioned source component its own notice, including shared Tcl/Tk terms.
    for a in records.values():
        if a.get('license_file'):
            path = 'licenses/' + a['license_file']
            if path not in owners:
                raise ValueError('native notice missing: ' + a['name'])
            owner = 'cpython' if a['name'] == 'cpython-3.14' else a['name']
            if owner != 'cpython':
                notices[owner].append(put((root / path).read_bytes(), 'licenses/native/' + owner + '/' + a['license_file'], owner=owner))
    with tarfile.open(inputs / build_source['filename']) as tar:
        data = tar.extractfile(prefix + 'LICENSE').read()
        if not data:
            raise ValueError('build-source licence missing')
        notices['build-source'].append(put(data, 'licenses/build-source/LICENSE', owner='build-source'))
    if not required.issubset(owners):
        raise ValueError('missing Python licences: ' + str(required - owners.keys()))
    # No alias points outside the pinned upstream install tree. Copying Python
    # executable aliases preserves prefix discovery; no system selector changes.
    extracted = out / 'extract'
    with tarfile.open(inputs / records['runtime']['filename']) as tar:
        tar.extractall(extracted, filter='data')
    source = extracted / 'python'
    for p in sorted(source.rglob('*')):
        resolved = p.resolve()
        if not resolved.is_relative_to(source.resolve()):
            raise ValueError('Python link escapes runtime')
        if p.is_dir():
            if p.is_symlink():
                raise ValueError('unsupported Python directory alias')
            continue
        if not resolved.is_file():
            raise ValueError('unsupported Python file')
        path = 'runtime/' + p.relative_to(source).as_posix()
        data = resolved.read_bytes()
        if 'license' in p.name.lower() or p.name == 'COPYING':
            if not data:
                raise ValueError('empty Python notice')
            notices['cpython'].append(path)
        put(data, path, bool(resolved.stat().st_mode & 0o111))
    put(lock_path.read_bytes(), 'artifact-lock.json')
    # Keep source availability discoverable in the delivered materials themselves.
    put(b'Complete upstream Python/native-library sources and matching build patches are in sources/.\nExact identities and download locations are in artifact-lock.json.\n', 'SOURCE-AVAILABILITY.txt')
    components = [dict(name=name, version=version, kind='native', license_files=sorted(notices[name])) for name, version in sorted(versions.items())]
    if any(not c['license_files'] for c in components):
        raise ValueError('component has no licence')
    profiles.seal(root, out, 'python', owners, components, [], requires=['uv'])
    shutil.rmtree(extracted)
    shutil.rmtree(root)


if __name__ == '__main__':
    build(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4])
