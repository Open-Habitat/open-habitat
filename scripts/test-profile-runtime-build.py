#!/usr/bin/env python3
import ast
import importlib.util
import os
import subprocess
import tarfile
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('profiles', Path(__file__).with_name('profile-runtime-build.py'))
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)


class BuilderTests(unittest.TestCase):
    def test_seal_reproducible_and_modes(self):
        with tempfile.TemporaryDirectory() as d:
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
        with tempfile.TemporaryDirectory() as d:
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
            with self.subTest(change=change), tempfile.TemporaryDirectory() as d:
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
