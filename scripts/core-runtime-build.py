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
import importlib.util


spec = importlib.util.spec_from_file_location('profiles', Path(__file__).with_name('profile-runtime-build.py'))
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)
spec = importlib.util.spec_from_file_location('rust_tools', Path(__file__).with_name('rust-tools-runtime.py'))
rust_tools = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rust_tools)
spec = importlib.util.spec_from_file_location('browser_builder', Path(__file__).with_name('browser-runtime-build.py'))
browser_builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(browser_builder)


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


# pi-claude-bridge starts Claude Code with no built-in tools on its provider
# path, so a Claude-subscription conversation had no web search while every
# other provider's has (Jari, 2026-11-10). Claude Code's own WebSearch and
# WebFetch run inside the bridge's query on the person's subscription; the
# bridge already leaves tool calls it does not serve to Claude Code. Upstream
# (0.12.0) has no option for it; elidickinson/pi-claude-bridge#261 proposes
# `provider.builtinTools`. The patch must apply exactly once, so a pin
# bump that moves the code fails the build instead of shipping unpatched.
BRIDGE_PATCH = (
    'pi-claude-bridge/src/index.ts',
    '\t\t\ttools: [],\n\t\t\tpermissionMode: "bypassPermissions",\n',
    '\t\t\ttools: ["WebSearch", "WebFetch"],\n\t\t\tpermissionMode: "bypassPermissions",\n',
)


def patch_bridge(modules):
    rel, old, new = BRIDGE_PATCH
    path = modules / rel
    text = path.read_text()
    assert text.count(old) == 1, 'pi-claude-bridge web tools patch does not apply'
    path.write_text(text.replace(old, new))


def build(work, out, release_target, inputs=Path('/inputs')):
    artifact_lock = json.loads((inputs / 'artifact-lock.json').read_text())
    node_pin = profiles.target_pin(artifact_lock['node'], release_target)
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

    def put_bytes(data, dest, owner, executable=False):
        dest = root / dest
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        dest.chmod(0o755 if executable else 0o644)
        owners[dest.relative_to(root).as_posix()] = owner

    node = work / node_pin['prefix']
    put(node / 'bin/node', 'runtime/bin/node', 'node')
    put(node / 'LICENSE', 'licenses/node.txt', 'node')
    components.append(dict(name='node', version='22.21.1', kind='node', license_files=['licenses/node.txt']))
    lock = json.loads((work / 'npm/package-lock.json').read_text())
    patch_bridge(work / 'npm/node_modules')
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
    # Taskfleet, its workmux and its bundled skills are part of every
    # installation's base runtime; `runtime/agent-bin` is the directory the
    # daemon appends to agents' PATH, so it holds only commands for them.
    scratch = work / 'tools'
    scratch.mkdir()
    rust_tools.add_tools(artifact_lock, release_target, root, scratch, put_bytes, components)
    put(inputs / 'agent-bin/pi', 'runtime/agent-bin/pi', 'agent-launcher')
    put(inputs / 'taskfleet-skills.mjs', 'runtime/taskfleet/extension.mjs', 'agent-launcher')
    put(inputs / 'web-search.mjs', 'runtime/web-search/extension.mjs', 'agent-launcher')
    # The agents' page reader and the headless shell it renders with, which
    # every installation gets (Jari, 2026-11-10); the browser profile's QA
    # Playwright uses the same shell.
    put(inputs / 'page-reader.mjs', 'runtime/page-reader/extension.mjs', 'agent-launcher')
    browser_builder.add_headless_shell(inputs / 'browser-lock.json', work / 'browser',
                                       lambda data, path, owner, mode: put_bytes(data, path, owner, mode == 0o755),
                                       components, digest, release_target)
    put(inputs / 'agent-bin/NOTICE', 'licenses/agent-launcher/NOTICE', 'agent-launcher')
    components.append(dict(name='agent-launcher', version='1', kind='native', license_files=['licenses/agent-launcher/NOTICE']))
    deb_lock_path = inputs / 'ubuntu-packages.json'
    packages = profiles.ubuntu_requirements(deb_lock_path, release_target)
    put(deb_lock_path, 'ubuntu-packages.json', 'ubuntu-requirements')
    components.append(dict(name='ubuntu-requirements', version='24.04', kind='lock', license_files=['ubuntu-packages.json']))
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
    build(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3])
