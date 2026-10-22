#!/usr/bin/env python3
import ast
import contextlib
import importlib.util
import os
import re
import shutil
import subprocess
import sys
import tarfile
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from unittest.mock import patch

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
            (inputs / 'ubuntu-packages.json').write_text(json.dumps(dict(packages=packages)))
            wheel = inputs / 'compose.whl'
            with zipfile.ZipFile(wheel, 'w') as z:
                z.writestr('podman_compose.py', 'print("synthetic-compose")')
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
            for suffix in ('dependency', 'parent', 'conflict'):
                root = d / suffix
                (root / 'DEBIAN').mkdir(parents=True)
                (root / 'DEBIAN').chmod(0o755)
                depends = 'Depends: open-habitat-closure-dependency (= 1.0)\n' if suffix == 'parent' else ''
                if suffix == 'conflict':
                    depends = 'Conflicts: open-habitat-closure-existing\n'
                (root / 'DEBIAN/control').write_text('Package: open-habitat-closure-' + suffix + '\nVersion: 1.0\nArchitecture: all\nMaintainer: Fixture <fixture@example.test>\nDescription: synthetic offline closure\n' + depends)
                (root / 'DEBIAN/control').chmod(0o644)
                archive = d / (suffix + '.deb')
                subprocess.run(['dpkg-deb', '--build', str(root), str(archive)], env=env, check=True, capture_output=True)
                archives.append(str(archive))
            command = ['apt-get', '-y', *guest.apt_policy_options(), *guest.apt_preview_options(d / 'lists'), 'install']
            missing = subprocess.run([*command, archives[1]], env=env, capture_output=True)
            complete = subprocess.run([*command, *archives[:2]], env=env, capture_output=True)
            self.assertNotEqual(missing.returncode, 0)
            self.assertEqual(complete.returncode, 0, complete.stderr.decode())
            status = d / 'status'
            status.write_text('Package: open-habitat-closure-existing\nStatus: install ok installed\nArchitecture: all\nVersion: 1.0\nMaintainer: Fixture <fixture@example.test>\nDescription: synthetic installed platform package\n\n')
            base = ['apt-get', '-y', *guest.apt_preview_options(d / 'lists'), '-o', 'Dir::State::status=' + str(status)]
            unsafe = subprocess.run([*base, '--no-download', 'install', archives[2]], env=env, capture_output=True)
            refused = subprocess.run([*base, *guest.apt_policy_options(), 'install', archives[2]], env=env, capture_output=True)
            self.assertEqual(unsafe.returncode, 0, unsafe.stderr.decode())
            self.assertNotEqual(refused.returncode, 0)


    def test_seed_generation_uses_supplied_public_trust(self):
        script = Path(__file__).with_name('test-core-runtime-vm.sh').read_text()
        code = re.findall(r"<<'PY'\n(.*?)^PY$", script, flags=re.M | re.S)[0]
        repo = Path(__file__).resolve().parent.parent
        with tempfile.TemporaryDirectory(dir='/var/tmp') as d:
            d = Path(d)
            key = d / 'public.key'
            key.write_bytes(b'p' * 32)
            for with_profiles in (False, True):
                run = d / str(with_profiles)
                run.mkdir()
                subprocess.run([sys.executable, '-c', code, str(run), str(key), '0.0.0-test', 'a' * 64, str(repo / 'test/vm/core-runtime-proof.py'), str(repo / 'test/vm/profile-runtime-proof.py') if with_profiles else ''], check=True)
                seed = json.loads((run / 'cloud.yaml').read_text().split('\n', 1)[1])
                target = next(f for f in seed['write_files'] if f['path'] == '/etc/core-runtime-target.json')
                self.assertEqual(json.loads(target['content']), dict(version='0.0.0-test', manifest_sha256='a' * 64))

    def test_every_profile_preview_precedes_sibling_installation(self):
        repo = Path(__file__).resolve().parent.parent
        spec = importlib.util.spec_from_file_location('guest', repo / 'test/vm/profile-runtime-proof.py')
        guest = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(guest)
        with tempfile.TemporaryDirectory(dir='/var/tmp') as d:
            d = Path(d)
            payloads = d / 'payloads'
            fs = d / 'guest'
            packages = {}
            for profile in ('core', 'native-build', 'containers'):
                source = payloads / profile
                (source / 'debs').mkdir(parents=True)
                name = 'fixture-' + profile
                package = dict(name=name, version='1.0', architecture='all', role='tool', filename=name + '.deb')
                packages[name] = package
                (source / 'ubuntu-packages.json').write_text(json.dumps(dict(packages=[package])))
                (source / 'debs' / package['filename']).write_bytes(b'synthetic')
            for path in ('home/agent-a', 'home/agent-b', 'var/tmp', 'var/cache/apt/archives', 'mnt/release'):
                (fs / path).mkdir(parents=True)
            (fs / 'mnt/release/release.json').write_text(json.dumps(dict(artifacts=[dict(profile=p, requires=[]) for p in ('core', 'native-build', 'containers')])))
            def guest_path(*args):
                path = Path(*args)
                return fs / str(path).lstrip('/') if path.is_absolute() else path
            events = []
            def run(*args, **kw):
                if args[0] == '/usr/bin/apt-get':
                    events.append(('preview' if '--simulate' in args else 'install', args))
                return subprocess.CompletedProcess(args, 0)
            def query(args, **kw):
                return ''.join(n + '\t1.0\tall\tinstall ok installed\n' for n in args[3:])
            with patch.object(guest, 'Path', guest_path), patch.object(guest, 'run', run), patch.object(guest.os, 'chown'), patch.object(guest.subprocess, 'check_output', query), contextlib.redirect_stdout(io.StringIO()):
                guest.proof(payloads)
            first_install = next(i for i,e in enumerate(events) if e[0] == 'install')
            previews = [i for i,e in enumerate(events) if e[0] == 'preview']
            self.assertEqual(len(previews), 3)
            self.assertLess(max(previews), first_install)
            container_preview = next(e for e in events if e[0] == 'preview' and any('fixture-containers.deb' in str(a) for a in e[1]))
            self.assertTrue(container_preview)
            for home in (fs / 'home').iterdir():
                shutil.rmtree(home)
                home.mkdir()
            def failed_native(*args, **kw):
                result = run(*args, **kw)
                if args[0] == '/bin/bash' and 'cc probe.c' in args[-1]:
                    raise subprocess.CalledProcessError(1, args)
                return result
            output = io.StringIO()
            with patch.object(guest, 'Path', guest_path), patch.object(guest, 'run', failed_native), patch.object(guest.os, 'chown'), patch.object(guest.subprocess, 'check_output', query), contextlib.redirect_stdout(output), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaisesRegex(RuntimeError, 'native-build'):
                    guest.proof(payloads)
            self.assertIn('PROFILE_RUNTIME_ACCEPTED profile=containers uid=21002', output.getvalue())
            self.assertNotIn('PROFILE_RUNTIME_PASS', output.getvalue())

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
