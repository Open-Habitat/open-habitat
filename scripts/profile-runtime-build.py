#!/usr/bin/env python3
"""Build locked optional Debian profiles; no install-time dependency resolver."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import zipfile


def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()


def seal(root, out, profile, owners, components, packages, requires=None):
    files = [dict(path=p, sha256=digest(root / p), component=owners[p], mode=(root / p).stat().st_mode & 0o777) for p in sorted(owners)]
    for c in components:
        records = ''.join(f['sha256'] + ' ' + f['path'] + '\n' for f in files if f['component'] == c['name'])
        c['sha256'] = hashlib.sha256(records.encode()).hexdigest()
    archive = out / (profile + '.tar.gz')
    with archive.open('wb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as gz, tarfile.open(fileobj=gz, mode='w', format=tarfile.GNU_FORMAT) as tar:
        for f in files:
            info = tar.gettarinfo(str(root / f['path']), arcname=f['path'])
            info.uid = info.gid = info.mtime = 0
            info.uname = info.gname = ''
            with (root / f['path']).open('rb') as src:
                tar.addfile(info, src)
    with gzip.open(archive, 'rb') as src:
        expanded = sum(len(b) for b in iter(lambda: src.read(1024 * 1024), b''))
    artifact = dict(profile=profile, archive=archive.name, sha256=digest(archive), size=archive.stat().st_size, expanded_size=expanded, entries=len(files), requires=requires or [], packages=packages, closure=dict(files=files, components=components))
    (out / 'artifact.json').write_text(json.dumps(artifact, separators=(',', ':')))
    return artifact


def build(profile, inputs, out):
    # Site profile grammar is deliberately narrower than arbitrary path input.
    import re
    if not re.fullmatch('[a-z][a-z0-9-]{0,62}', profile):
        raise ValueError('invalid profile')
    out.mkdir(mode=0o700)
    root = out / 'payload'
    root.mkdir()
    owners = {}
    components = []

    def put(src, path, owner):
        dest = root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
        dest.chmod(0o644)
        owners[path] = owner

    lock_path = inputs / 'ubuntu-packages.json'
    lock = json.loads(lock_path.read_text())
    packages = lock['packages']
    import re
    seen = set()
    for p in packages:
        if set(p) != {'name', 'architecture', 'version'} or not re.fullmatch(r'[a-z0-9][a-z0-9+.-]{0,127}', p['name']) or p['architecture'] not in ('amd64', 'all') or not re.fullmatch(r'[0-9][a-zA-Z0-9.+:~_-]{0,199}', p['version']) or p['name'] in seen:
            raise ValueError('invalid Ubuntu requirement')
        seen.add(p['name'])
    put(lock_path, 'ubuntu-packages.json', 'ubuntu-requirements')
    components.append(dict(name='ubuntu-requirements', version='24.04', kind='lock', license_files=['ubuntu-packages.json']))
    if profile == 'containers':
        # Product-owned configuration is part of the authenticated profile,
        # not an unrecorded guest-only workaround.
        config = Path(__file__).resolve().parent.parent / 'runtime/profiles/containers/config'
        notice = config / 'NOTICE'
        put(notice, 'licenses/container-session/NOTICE', 'container-session')
        for src, dest in [('initialize-netns', 'runtime/bin/initialize-netns'),
                          ('open-habitat-containers.service', 'runtime/systemd/user/open-habitat-containers.service')]:
            put(config / src, dest, 'container-session')
        (root / 'runtime/bin/initialize-netns').chmod(0o755)
        components.append(dict(name='container-session', version='1', kind='native', license_files=['licenses/container-session/NOTICE']))
        compose_lock_path = inputs / 'artifact-lock.json'
        compose = json.loads(compose_lock_path.read_text())
        wheel = inputs / compose['filename']
        if digest(wheel) != compose['sha256']:
            raise ValueError('compose digest mismatch')
        versions = {p['name']: p['version'] for p in packages}
        if compose['deb_dependencies'] != {name: versions.get(name) for name in ('python3-dotenv', 'python3-yaml')}:
            raise ValueError('compose dependency lock mismatch')
        ident = 'podman-compose'
        with zipfile.ZipFile(wheel) as z:
            prefix = 'podman_compose-' + compose['version'] + '.dist-info/'
            for name, dest in [('podman_compose.py', 'runtime/lib/podman_compose.py'),
                               (prefix + 'licenses/LICENSE', 'licenses/compose/LICENSE'),
                               (prefix + 'METADATA', 'licenses/compose/METADATA')]:
                data = z.read(name)
                if not data.strip():
                    raise ValueError('empty compose source/notice')
                target = root / dest
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                target.chmod(0o644)
                owners[dest] = ident
        wrapper = root / 'runtime/bin/podman-compose'
        wrapper.write_text('#!/bin/sh\nset -eu\nbase=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)\n"$base/bin/initialize-netns"\nexec /usr/bin/python3 -I "$base/lib/podman_compose.py" --in-pod=false "$@"\n')
        wrapper.chmod(0o755)
        owners['runtime/bin/podman-compose'] = ident
        put(compose_lock_path, 'compose-lock.json', ident)
        put(wheel, 'sources/podman_compose.whl', ident)
        components.append(dict(name=ident, version=compose['version'], kind='native', license_files=['licenses/compose/LICENSE']))

    if profile == 'browser':
        # Playwright's retained notice closure includes the distro common texts;
        # these are licence records, not shipped Ubuntu executable packages.
        for p in sorted(Path('/usr/share/common-licenses').iterdir()):
            if p.is_file():
                put(p, 'licenses/common/' + p.name, 'common-licenses')
        components.append(dict(name='common-licenses', version='24.04', kind='license', license_files=[p for p in owners if p.startswith('licenses/common/')]))
        import importlib.util
        spec = importlib.util.spec_from_file_location('browser_builder', Path(__file__).with_name('browser-runtime-build.py'))
        browser_builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(browser_builder)
        browser_builder.add_browser(inputs / 'artifact-lock.json', inputs, root, owners, components, digest)
    requires = ['media'] if profile == 'documents' else ['python'] if profile == 'browser' else []
    artifact = seal(root, out, profile, owners, components, packages, requires=requires)
    shutil.rmtree(root)
    print(json.dumps(dict(profile=profile, archive_sha256=artifact['sha256'], packages=len(packages))), flush=True)


if __name__ == '__main__':
    build(sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]))
