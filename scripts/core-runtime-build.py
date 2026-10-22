#!/usr/bin/env python3
"""Materialize link-free runtime and complete component/file/license inventory."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import gzip


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def build(work, out):
    root = out / 'payload'
    root.mkdir()
    components = []
    owners = {}

    def put(src, dest, owner):
        dest = root / dest
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)
        dest.chmod(0o755 if src.stat().st_mode & 0o111 else 0o644)
        owners[dest.relative_to(root).as_posix()] = owner

    node = work / 'node-v22.21.1-linux-x64'
    put(node / 'bin/node', 'runtime/bin/node', 'node')
    put(node / 'LICENSE', 'licenses/node.txt', 'node')
    components.append(dict(name='node', version='22.21.1', kind='node', license_files=['licenses/node.txt']))
    lock = json.loads((work / 'npm/package-lock.json').read_text())
    installed = {}
    for p in sorted((work / 'npm/node_modules').rglob('package.json')):
        # Only package roots named in npm's lock, not vendored example manifests.
        rel = p.parent.relative_to(work / 'npm').as_posix()
        if rel in lock['packages']:
            installed[rel] = p.parent
    for rel, directory in installed.items():
        meta = json.loads((directory / 'package.json').read_text())
        expected = lock['packages'][rel]
        assert meta['version'] == expected['version'], rel
        # Longest package-root owner wins; nested dependencies own their files.
        ident = 'npm:' + rel
        licenses = []
        for p in sorted(directory.rglob('*')):
            if p.is_dir() or 'node_modules' in p.relative_to(directory).parts:
                continue
            if p.is_symlink():
                assert p.resolve().is_relative_to((work / 'npm').resolve()), p
            target = 'runtime/' + p.relative_to(work / 'npm').as_posix()
            put(p, target, ident)
            if p.parent == directory and p.name.lower().startswith(('license', 'licence', 'copying', 'notice')):
                licenses.append(target)
        # Package metadata is itself a licence record where upstream supplies
        # only an SPDX expression; never synthesize a permissive licence.
        if not licenses:
            assert meta.get('license') and meta['license'] != 'UNLICENSED', rel
            licenses = ['runtime/' + rel + '/package.json']
        components.append(dict(name=ident, version=meta['version'], kind='npm', license_files=licenses))
    put(work / 'npm/package-lock.json', 'runtime/package-lock.json', 'npm-lock')
    put(work / 'npm/package.json', 'runtime/package.json', 'npm-lock')
    components.append(dict(name='npm-lock', version='1.0.0', kind='lock', license_files=['runtime/package.json']))
    deb_lock_path = Path('/inputs/ubuntu-packages.json')
    deb_lock = json.loads(deb_lock_path.read_text())
    expected_debs = {p['filename']: p for p in deb_lock['packages']}
    actual_debs = {p.name: p for p in (out / 'debs').glob('*.deb')}
    assert actual_debs.keys() == expected_debs.keys(), 'missing or extra Ubuntu closure member'
    for name, p in actual_debs.items():
        assert digest(p) == expected_debs[name]['sha256'], name
    put(deb_lock_path, 'ubuntu-packages.json', 'deb-lock')
    components.append(dict(name='deb-lock', version='24.04', kind='lock', license_files=['ubuntu-packages.json']))
    packages = []
    extracted = work / 'deb-extract'
    extracted.mkdir(parents=True, exist_ok=True)
    for deb in sorted((out / 'debs').glob('*.deb')):
        subprocess.run(['dpkg-deb', '-x', str(deb), str(extracted)], check=True)
    for deb in sorted((out / 'debs').glob('*.deb')):
        name, version, arch = subprocess.check_output(['dpkg-deb', '-f', str(deb), 'Package', 'Version', 'Architecture'], text=True).splitlines()
        # dpkg-deb labels multi-field output.
        name, version, arch = [s.split(': ', 1)[-1] for s in (name, version, arch)]
        assert expected_debs[deb.name]['name'] == name and expected_debs[deb.name]['version'] == version and expected_debs[deb.name]['architecture'] == arch, deb
        ident = 'deb:' + name
        copyright = extracted / 'usr/share/doc' / name / 'copyright'
        if copyright.is_symlink():
            link = os.readlink(copyright)
            copyright = (copyright.parent / link).resolve() if not link.startswith('/') else extracted / link.lstrip('/')
        assert copyright.is_file(), (name, copyright)
        licence = 'licenses/deb/' + name + '/copyright'
        put(copyright, licence, ident)
        put(deb, 'debs/' + deb.name, ident)
        role = expected_debs[deb.name]['role']
        assert role in ('tool', 'platform'), deb
        components.append(dict(name=ident, version=version, kind='platform-deb' if role == 'platform' else 'deb', license_files=[licence]))
        if role == 'tool':
            packages.append(dict(name=name, version=version, architecture=arch))
    # Debian copyright records refer to the distro's common licence texts.
    for p in sorted(Path('/usr/share/common-licenses').iterdir()):
        if p.is_file():
            put(p, 'licenses/common/' + p.name, 'common-licenses')
    components.append(dict(name='common-licenses', version='24.04', kind='license', license_files=[p for p in owners if p.startswith('licenses/common/')]))
    files = [dict(path=p, sha256=digest(root / p), component=owners[p], mode=(root / p).stat().st_mode & 0o777) for p in sorted(owners)]
    for c in components:
        records = ''.join(f["sha256"] + ' ' + f['path'] + '\n' for f in files if f['component'] == c['name'])
        c['sha256'] = hashlib.sha256(records.encode()).hexdigest()
    archive = out / 'core.tar.gz'
    with archive.open('wb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as gz, tarfile.open(fileobj=gz, mode='w', format=tarfile.GNU_FORMAT) as tar:
        for f in files:
            info = tar.gettarinfo(str(root / f['path']), arcname=f['path'])
            info.uid = info.gid = info.mtime = 0
            info.uname = info.gname = ''
            with (root / f['path']).open('rb') as src:
                tar.addfile(info, src)
    with gzip.open(archive, 'rb') as src:
        expanded = sum(len(b) for b in iter(lambda: src.read(1024 * 1024), b''))
    artifact = dict(profile='core', archive=archive.name, sha256=digest(archive), size=archive.stat().st_size, expanded_size=expanded, entries=len(files), requires=[], packages=packages, closure=dict(files=files, components=components))
    (out / 'artifact.json').write_text(json.dumps(artifact, separators=(',', ':')))
    print(json.dumps({'files': len(files), 'components': len(components), 'packages': len(packages), 'archive_sha256': artifact['sha256']}))


if __name__ == '__main__':
    build(Path(sys.argv[1]), Path(sys.argv[2]))
