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
    expected = {p['filename']: p for p in lock['packages']}
    actual = {p.name: p for p in (inputs / 'debs').glob('*.deb')}
    if len(expected) != len(lock['packages']) or actual.keys() != expected.keys():
        raise ValueError('missing, duplicate or extra package')
    # Check bytes before letting even the disposable build tools inspect them.
    for name, deb in actual.items():
        if digest(deb) != expected[name]['sha256']:
            raise ValueError('package digest mismatch: ' + name)
    extracted = out / 'extract'
    extracted.mkdir()
    for deb in sorted(actual.values()):
        subprocess.run(['dpkg-deb', '-x', str(deb), str(extracted)], check=True)
    packages = []
    for filename, p in sorted(expected.items()):
        deb = actual[filename]
        fields = subprocess.check_output(['dpkg-deb', '-f', str(deb), 'Package', 'Version', 'Architecture'], text=True).splitlines()
        if [v.split(': ', 1)[-1] for v in fields] != [p['name'], p['version'], p['architecture']]:
            raise ValueError('package identity mismatch')
        ident = 'deb:' + p['name']
        copyright = extracted / 'usr/share/doc' / p['name'] / 'copyright'
        # Debian packages can point to a different package's notice, including
        # absolute distro paths. Resolve only within the disposable extraction.
        for _ in range(20):
            if not copyright.is_symlink():
                break
            link = os.readlink(copyright)
            copyright = extracted / link.lstrip('/') if link.startswith('/') else copyright.parent / link
        copyright = copyright.resolve()
        if not copyright.is_relative_to(extracted.resolve()) or not copyright.is_file() or copyright.stat().st_size == 0:
            raise ValueError('license_unverified: ' + p['name'])
        notice = 'licenses/deb/' + p['name'] + '/copyright'
        put(copyright, notice, ident)
        put(deb, 'debs/' + filename, ident)
        if p['role'] not in ('tool', 'platform'):
            raise ValueError('invalid package role')
        components.append(dict(name=ident, version=p['version'], kind='deb' if p['role'] == 'tool' else 'platform-deb', license_files=[notice]))
        if p['role'] == 'tool':
            packages.append({k: p[k] for k in ('name', 'version', 'architecture')})
    put(lock_path, 'ubuntu-packages.json', 'deb-lock')
    components.append(dict(name='deb-lock', version='24.04', kind='lock', license_files=['ubuntu-packages.json']))
    for p in sorted(Path('/usr/share/common-licenses').iterdir()):
        if p.is_file():
            put(p, 'licenses/common/' + p.name, 'common-licenses')
    components.append(dict(name='common-licenses', version='24.04', kind='license', license_files=[p for p in owners if p.startswith('licenses/common/')]))
    artifact = seal(root, out, profile, owners, components, packages, requires=["media"] if profile == "documents" else [])
    shutil.rmtree(extracted)
    shutil.rmtree(root)
    print(json.dumps(dict(profile=profile, archive_sha256=artifact['sha256'], packages=len(packages))), flush=True)


if __name__ == '__main__':
    build(sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]))
