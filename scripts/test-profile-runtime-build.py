#!/usr/bin/env python3
import ast
import importlib.util
import os
import re
import shutil
import subprocess
import tarfile
import io
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('profiles', Path(__file__).with_name('profile-runtime-build.py'))
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)


class BuilderTests(unittest.TestCase):
    def test_seal_reproducible_and_modes(self):
        with tempfile.TemporaryDirectory(dir="/var/tmp") as d:
            d = Path(d)
            digests = []
            for name in ('a', 'b'):
                out = d / name
                root = out / 'payload'
                root.mkdir(parents=True)
                (root / 'LICENSE').write_text('upstream notice')
                (root / 'tool').write_text('#!/bin/sh\nexit 0\n')
                (root / 'LICENSE').chmod(0o644)
                (root / 'tool').chmod(0o755)
                a = profiles.seal(root, out, 'editor', {'LICENSE': 'tool', 'tool': 'tool'}, [dict(name='tool', version='1.0', kind='native', license_files=['LICENSE'])], [])
                self.assertEqual([f['mode'] for f in a['closure']['files']], [0o644, 0o755])
                self.assertEqual(a['entries'], 2)
                digests.append(a['sha256'])
            self.assertEqual(*digests)

    @unittest.skipUnless(shutil.which('apt-get') and shutil.which('dpkg-deb'), 'native Debian tools unavailable')
    def test_profile_preflight_has_no_sibling_or_repository_fallback(self):
        fixture = Path(__file__).resolve().parent.parent / 'test/vm/profile-runtime-proof.py'
        spec = importlib.util.spec_from_file_location('guest', fixture)
        guest = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(guest)
        with tempfile.TemporaryDirectory(dir='/var/tmp') as d:
            d = Path(d)
            env = {'PATH': '/usr/bin:/bin', 'HOME': str(d), 'LANG': 'C.UTF-8', 'TMPDIR': str(d)}
            archives = []
            for suffix in ('dependency', 'parent'):
                root = d / suffix
                (root / 'DEBIAN').mkdir(parents=True)
                depends = 'Depends: open-habitat-closure-dependency (= 1.0)\n' if suffix == 'parent' else ''
                (root / 'DEBIAN/control').write_text('Package: open-habitat-closure-' + suffix + '\nVersion: 1.0\nArchitecture: all\nMaintainer: Fixture <fixture@example.test>\nDescription: synthetic offline closure\n' + depends)
                archive = d / (suffix + '.deb')
                subprocess.run(['dpkg-deb', '--build', str(root), str(archive)], env=env, check=True, capture_output=True)
                archives.append(str(archive))
            command = ['apt-get', '-y', '--no-download', '--no-install-recommends', *guest.apt_preview_options(d / 'lists'), 'install']
            missing = subprocess.run([*command, archives[1]], env=env, capture_output=True)
            complete = subprocess.run([*command, *archives], env=env, capture_output=True)
            self.assertNotEqual(missing.returncode, 0)
            self.assertEqual(complete.returncode, 0, complete.stderr.decode())

    def test_vm_runner_embedded_python_compiles(self):
        script = Path(__file__).with_name('test-core-runtime-vm.sh').read_text()
        subprocess.run(['bash', '-n'], input=script, text=True, check=True)
        for code in re.findall(r"<<'PY'\n(.*?)^PY$", script, flags=re.M | re.S):
            compile(code, 'runtime-vm-inline', 'exec')

    def test_uv_cannot_drop_a_cargo_lock_member(self):
        spec = importlib.util.spec_from_file_location('uv', Path(__file__).with_name('uv-runtime-build.py'))
        uv = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(uv)
        with tempfile.TemporaryDirectory(dir="/var/tmp") as d:
            d = Path(d)
            inputs = d / 'inputs'
            inputs.mkdir()
            def tar_file(path, files):
                with tarfile.open(path, 'w:gz') as tar:
                    for name, body in files.items():
                        data = body.encode()
                        info = tarfile.TarInfo(name)
                        info.size = len(data)
                        tar.addfile(info, io.BytesIO(data))
            tar_file(inputs / 'uv.tar.gz', {'uv-x86_64-unknown-linux-gnu/uv': 'binary', 'uv-x86_64-unknown-linux-gnu/uvx': 'binary'})
            cargo = '[[package]]\nname="omitted"\nversion="1.0"\nsource="registry+https://github.com/rust-lang/crates.io-index"\nchecksum="' + 'a' * 64 + '"\n'
            tar_file(inputs / 'source.tar.gz', {'uv-1.0/Cargo.lock': cargo})
            lock = d / 'lock.json'
            lock.write_text(json.dumps(dict(version='1.0', archive=dict(sha256=profiles.digest(inputs / 'uv.tar.gz')), source=dict(sha256=profiles.digest(inputs / 'source.tar.gz')), crates=[])))
            with self.assertRaisesRegex(ValueError, 'incomplete Rust source lock'):
                uv.build(lock, inputs, d / 'out')
            self.assertFalse((d / 'out/artifact.json').exists())

    def test_guest_recipes_compile(self):
        fixture = Path(__file__).resolve().parent.parent / 'test/vm/profile-runtime-proof.py'
        tree = ast.parse(fixture.read_text())
        scripts = next(ast.literal_eval(n.value) for n in ast.walk(tree) if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'scripts' for t in n.targets))
        for name, text in scripts.items():
            with self.subTest(profile=name):
                subprocess.run(['bash', '-n'], input=text, text=True, check=True)
                for marker in ('EDITOR_PY', 'CONTAINER_PY'):
                    if "<<'" + marker + "'\n" in text:
                        compile(text.split("<<'" + marker + "'\n", 1)[1].split('\n' + marker, 1)[0], name, 'exec')

    def test_editor_alias_uses_real_target_and_bundled_node(self):
        spec = importlib.util.spec_from_file_location('editor', Path(__file__).with_name('editor-runtime-build.py'))
        editor = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(editor)
        with tempfile.TemporaryDirectory(dir="/var/tmp") as d:
            d = Path(d)
            source = d / 'upstream/pkg'
            (source / 'node_modules/.bin').mkdir(parents=True)
            (source / 'node_modules/tool').mkdir()
            (source / 'lib').mkdir()
            (source / 'LICENSE').write_text('upstream MIT notice')
            (source / 'node_modules/tool/main.js').write_text('#!/usr/bin/env node\n')
            (source / 'node_modules/tool/main.js').chmod(0o755)
            (source / 'node_modules/tool/sibling').write_text('native-alias-ok')
            (source / 'lib/node').write_text('#!/bin/sh\ncat "$(dirname "$1")/sibling"\n')
            (source / 'lib/node').chmod(0o755)
            (source / 'node_modules/.bin/tool').symlink_to('../tool/main.js')
            archive = d / 'upstream.tar.gz'
            with tarfile.open(archive, 'w:gz') as tar:
                tar.add(source, arcname='pkg')
            lock = d / 'lock.json'
            lock.write_text(json.dumps(dict(name='editor', version='1.0', profile='editor', prefix='pkg', sha256=profiles.digest(archive), licenses=['LICENSE'])))
            editor.build(lock, archive, d / 'out')
            with tarfile.open(d / 'out/editor.tar.gz') as tar:
                tar.extractall(d / 'installed', filter='data')
            result = subprocess.check_output([str(d / 'installed/runtime/node_modules/.bin/tool')], env={'PATH': '/usr/bin:/bin'}, text=True)
            self.assertEqual(result, 'native-alias-ok')

    def test_reject_before_dpkg(self):
        for change in ('extra', 'missing', 'digest'):
            with self.subTest(change=change), tempfile.TemporaryDirectory(dir="/var/tmp") as d:
                d = Path(d)
                inputs = d / 'inputs'
                (inputs / 'debs').mkdir(parents=True)
                deb = inputs / 'debs/tool.deb'
                deb.write_bytes(b'not a real deb')
                p = dict(filename='tool.deb', sha256=profiles.digest(deb))
                if change == 'digest':
                    p['sha256'] = '0' * 64
                elif change == 'missing':
                    deb.unlink()
                else:
                    (inputs / 'debs/extra.deb').write_bytes(b'extra')
                (inputs / 'ubuntu-packages.json').write_text(json.dumps(dict(packages=[p])))
                with self.assertRaises(ValueError):
                    profiles.build('test', inputs, d / 'out')


if __name__ == '__main__':
    unittest.main()
