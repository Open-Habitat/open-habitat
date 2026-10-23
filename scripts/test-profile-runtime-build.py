#!/usr/bin/env python3
import contextlib
import importlib.util
import shutil
import subprocess
import tarfile
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('profiles', Path(__file__).with_name('profile-runtime-build.py'))
profiles = importlib.util.module_from_spec(spec)
spec.loader.exec_module(profiles)


class BuilderTests(unittest.TestCase):
    def test_container_init_refuses_missing_or_foreign_runtime(self):
        repo = Path(__file__).resolve().parent.parent
        helper = repo / 'runtime/profiles/containers/config/initialize-netns'
        for runtime in ('', '/var/tmp', '/run/user/987654321'):
            result = subprocess.run(['/bin/sh', str(helper)], env={'PATH': '/nonexistent', 'XDG_RUNTIME_DIR': runtime}, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b'requires a native user runtime', result.stderr)

    @unittest.skipUnless(shutil.which('dpkg-deb'), 'native Debian tools unavailable')
    def test_container_configuration_and_compose_are_authenticated(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as d:
            d = Path(d)
            inputs = d / 'inputs'
            (inputs / 'debs').mkdir(parents=True)
            packages = []
            for name in ('python3-dotenv', 'python3-yaml'):
                root = d / name
                (root / 'DEBIAN').mkdir(parents=True)
                (root / 'DEBIAN').chmod(0o755)
                (root / 'DEBIAN/control').write_text('Package: ' + name + '\nVersion: 1.0\nArchitecture: all\nMaintainer: Fixture <fixture@example.test>\nDescription: synthetic\n')
                (root / 'DEBIAN/control').chmod(0o644)
                notice = root / 'usr/share/doc' / name / 'copyright'
                notice.parent.mkdir(parents=True)
                notice.write_text('synthetic notice')
                deb = inputs / 'debs' / (name + '.deb')
                subprocess.run(['dpkg-deb', '--build', str(root), str(deb)], check=True, capture_output=True)
                packages.append(dict(name=name, version='1.0', architecture='all', role='tool', filename=deb.name, sha256=profiles.digest(deb)))
            (inputs / 'ubuntu-packages.json').write_text(json.dumps(dict(packages=[{k: p[k] for k in ('name', 'version', 'architecture')} for p in packages])))
            wheel = inputs / 'compose.whl'
            with zipfile.ZipFile(wheel, 'w') as z:
                z.writestr('podman_compose.py', 'import sys\nassert sys.argv[1] == "--in-pod=false"\nprint("synthetic-compose")')
                z.writestr('podman_compose-1.5.0.dist-info/licenses/LICENSE', 'synthetic GPL-2.0-only notice')
                z.writestr('podman_compose-1.5.0.dist-info/METADATA', 'synthetic metadata')
            lock = dict(version='1.5.0', filename=wheel.name, sha256=profiles.digest(wheel), deb_dependencies={p['name']: p['version'] for p in packages})
            (inputs / 'artifact-lock.json').write_text(json.dumps(lock))
            with contextlib.redirect_stdout(io.StringIO()):
                profiles.build('containers', inputs, d / 'out')
            artifact = json.loads((d / 'out/artifact.json').read_text())
            files = {f['path']: f for f in artifact['closure']['files']}
            for name in ('initialize-netns', 'podman-compose'):
                self.assertEqual(files['runtime/bin/' + name]['mode'], 0o755)
            self.assertEqual(files['runtime/bin/initialize-netns']['component'], 'container-session')
            self.assertEqual(files['runtime/lib/podman_compose.py']['component'], 'podman-compose')
            self.assertIn('compose-lock.json', files)
            with tarfile.open(d / 'out/containers.tar.gz') as tar:
                tar.extractall(d / 'installed', filter='data')
            # Replace only the initializer in this extracted synthetic fixture;
            # actual namespace persistence is exercised in the fresh guest.
            (d / 'installed/runtime/bin/initialize-netns').write_text('#!/bin/sh\necho initialization-called\n')
            result = subprocess.check_output([str(d / 'installed/runtime/bin/podman-compose')], env={'PATH': '/usr/bin:/bin'}, text=True)
            self.assertEqual(result, 'initialization-called\nsynthetic-compose\n')
            lock['deb_dependencies']['python3-yaml'] = 'wrong'
            (inputs / 'artifact-lock.json').write_text(json.dumps(lock))
            with self.assertRaisesRegex(ValueError, 'dependency lock mismatch'):
                profiles.build('containers', inputs, d / 'missing-dependency')
            wheel.write_bytes(b'tampered')
            with self.assertRaisesRegex(ValueError, 'compose digest mismatch'):
                profiles.build('containers', inputs, d / 'tampered')

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

    def test_reject_legacy_deb_input(self):
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
