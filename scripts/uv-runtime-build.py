#!/usr/bin/env python3
"""Carry native uv, retained notices and the locked Rust source graph offline."""
import importlib.util
import json
from pathlib import Path, PurePosixPath
import shutil
import sys
import tarfile
import tomllib

spec = importlib.util.spec_from_file_location('profiles', Path(__file__).with_name('profile-runtime-build.py'))
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)


def build(lock_path, inputs, out, target):
    lock = json.loads(lock_path.read_text())
    pin = profiles.target_pin(lock, target)
    out.mkdir(mode=0o700)
    root = out / 'payload'
    root.mkdir()
    owners = {}
    notices = []

    def put_bytes(data, path, mode=0o644):
        p = root / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        p.chmod(mode)
        owners[path] = 'uv'

    def checked(p, expected):
        if profiles.digest(p) != expected:
            raise ValueError('source or binary digest mismatch: ' + p.name)

    def retain_sources(archive, dest):
        # Source payloads are retained as whole immutable archives as well as
        # uncompressed licence records, including MPL and vendored C notices.
        put_bytes(archive.read_bytes(), 'sources/' + dest)
        with tarfile.open(archive) as tar:
            for f in tar:
                name = PurePosixPath(f.name)
                if not f.isfile():
                    continue
                if '..' in name.parts or name.is_absolute():
                    raise ValueError('unsafe source member')
                if name.name.lower().startswith(('license', 'licence', 'copying', 'notice')) or name.name == 'Cargo.toml':
                    data = tar.extractfile(f).read()
                    path = 'licenses/' + dest + '/' + name.as_posix()
                    put_bytes(data, path)
                    if data and name.name != 'Cargo.toml':
                        notices.append(path)

    archive = inputs / 'uv.tar.gz'
    checked(archive, pin['sha256'])
    with tarfile.open(archive) as tar:
        for name in ('uv', 'uvx'):
            f = tar.getmember(pin['prefix'] + '/' + name)
            if not f.isfile():
                raise ValueError('regular native binary required')
            put_bytes(tar.extractfile(f).read(), 'runtime/bin/' + name, 0o755)
    source = inputs / 'source.tar.gz'
    checked(source, lock['source']['sha256'])
    with tarfile.open(source) as tar:
        cargo_lock = tomllib.loads(tar.extractfile('uv-' + lock['version'] + '/Cargo.lock').read().decode())
    expected = {(p['name'], p['version'], p['checksum']) for p in cargo_lock['package'] if p.get('source', '').startswith('registry+')}
    actual = {(p['name'], p['version'], p['sha256']) for p in lock['crates']}
    if actual != expected or len(actual) != len(lock['crates']) or any(p.get('source', '').startswith('git+') for p in cargo_lock['package']):
        raise ValueError('incomplete Rust source lock')
    retain_sources(source, 'uv-source.tar.gz')
    for p in lock['crates']:
        if not p['license'] or p['license'] == 'UNLICENSED':
            raise ValueError('license_unverified: ' + p['name'])
        archive = inputs / p['filename']
        checked(archive, p['sha256'])
        with tarfile.open(archive) as tar:
            manifest = tomllib.loads(tar.extractfile(p['name'] + '-' + p['version'] + '/Cargo.toml').read().decode())
            if manifest['package'].get('license') != p['license']:
                raise ValueError('crate licence declaration mismatch')
        retain_sources(archive, p['filename'])
    put_bytes(lock_path.read_bytes(), 'artifact-lock.json')
    # SPDX declarations and source identities remain explicit, not an invented
    # blanket licence for all linked dependencies.
    notices.append('artifact-lock.json')
    profiles.seal(root, out, 'uv', owners, [dict(name='uv', version=lock['version'], kind='native', license_files=sorted(notices))], [], requires=['native-build'])
    shutil.rmtree(root)


if __name__ == '__main__':
    build(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4])
