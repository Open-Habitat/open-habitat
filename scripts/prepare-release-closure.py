#!/usr/bin/env python3
"""Internal prepare-release helper: cache build outputs, never release identities."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile


def runtime_key(repo, commit):
    # Same input selection as the release cut; content comparison works across
    # histories too. Commit IDs and product-only changes must not invalidate it.
    rows = subprocess.check_output(['git', '-C', str(repo), 'ls-tree', '-r', '-z',
                                    '--full-tree', commit], text=True).split('\0')
    blobs = {}
    for row in filter(None, rows):
        meta, path = row.split('\t', 1)
        name = path.removeprefix('scripts/') if path.startswith('scripts/') else None
        if (path.startswith('runtime/') or path in
                ('scripts/download-profile-inputs.py', 'scripts/go-binary-notices.py') or
                (name is not None and '/' not in name and 'runtime' in name and
                 not name.startswith('test-'))):
            # Include the executable bit: builders preserve source file modes.
            blobs[path] = meta.split()[0] + ' ' + meta.split()[2]
    if 'runtime/core/artifact-lock.json' not in blobs:
        raise ValueError('runtime inputs missing from source')
    return hashlib.sha256(json.dumps(blobs, sort_keys=True).encode()).hexdigest()


def snapshot(repo, commit, dest):
    dest.mkdir()
    with subprocess.Popen(['git', '-C', str(repo), 'archive', commit, 'runtime', 'scripts'],
                          stdout=subprocess.PIPE) as archive:
        try:
            subprocess.run(['tar', '-xf', '-', '-C', str(dest)], stdin=archive.stdout, check=True)
        finally:
            archive.stdout.close()
        if archive.wait():
            raise ValueError('cannot export committed runtime inputs')


def run(*args):
    subprocess.run([str(a) for a in args], check=True, stdout=sys.stderr)


def assemble(source, output, binary, target, version, commit):
    artifacts = [json.loads((source / profile / 'artifact.json').read_text())
                 for profile in ('core', 'integrations')]
    output.mkdir()
    for profile, artifact in zip(('core', 'integrations'), artifacts):
        name = artifact['archive']
        if name != profile + '.tar.gz':
            raise ValueError('unexpected runtime archive name')
        shutil.copyfile(source / profile / name, output / name)
    descriptors = output / 'artifacts.json'
    descriptors.write_text(json.dumps(artifacts))
    # The product verifier checks hashes, closure, target and current core pins
    # before writing release.json. Cached bytes are not trusted on their own.
    run(binary, 'manifest', '--directory', output, '--artifacts-file', descriptors,
        '--version', version, '--commit', commit,
        '--platform', target.replace('linux-', 'ubuntu-24.04-'))
    descriptors.unlink()


def prepare(repo, cache, output, binary, target, version, commit):
    if output.exists():
        raise ValueError(f'runtime output already exists: {output}')
    key = runtime_key(repo, commit)
    cache.mkdir(parents=True, exist_ok=True)
    entry = cache / (target + '-' + key)
    # Serialize writers and readers, including across different release versions.
    with (cache / (entry.name + '.lock')).open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        with tempfile.TemporaryDirectory(prefix='runtime-release-', dir=output.parent) as stage:
            stage = Path(stage)
            release = stage / 'release'
            if entry.exists():
                assemble(entry, release, binary, target, version, commit)
            else:
                native = {'x86_64': 'linux-amd64', 'aarch64': 'linux-arm64'}.get(platform.machine())
                if platform.system() != 'Linux' or native != target:
                    raise ValueError(f'no cached runtime for {target}; build once on a native {target} host with the same inputs and copy the cache entry')
                # Build inside the cache filesystem so publishing is atomic. Failed
                # builds and invalid closures never become reusable entries.
                with tempfile.TemporaryDirectory(prefix='.build-', dir=cache) as work:
                    work = Path(work)
                    source = work / 'source'
                    snapshot(repo, commit, source)
                    run(source / 'scripts/build-core-runtime.sh', '--target', target, work / 'core')
                    run(source / 'scripts/build-profile-runtime.sh', '--target', target,
                        'integrations', work / 'integrations')
                    assemble(work, release, binary, target, version, commit)
                    # Keep only sealed outputs, not npm/download/build scratch.
                    sealed = work / 'sealed'
                    sealed.mkdir()
                    for profile in ('core', 'integrations'):
                        dest = sealed / profile
                        dest.mkdir()
                        for name in ('artifact.json', profile + '.tar.gz'):
                            shutil.copyfile(work / profile / name, dest / name)
                    sealed.rename(entry)
            release.rename(output)


if __name__ == '__main__':
    try:
        repo, cache, output, binary, target, version, commit = sys.argv[1:]
        prepare(Path(repo), Path(cache), Path(output), Path(binary), target, version, commit)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        sys.exit(f'error: runtime preparation failed: {error}')
