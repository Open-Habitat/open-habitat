#!/usr/bin/env python3
import contextlib
import importlib.util
import shutil
import struct
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
spec = importlib.util.spec_from_file_location('go_notices', Path(__file__).with_name('go-binary-notices.py'))
go_notices = importlib.util.module_from_spec(spec)
spec.loader.exec_module(go_notices)
spec = importlib.util.spec_from_file_location('integrations_build', Path(__file__).with_name('integrations-runtime-build.py'))
integrations_build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integrations_build)


def elf(sections):
    """A minimal little-endian ELF64 file with the given (name, data) sections."""
    names = b'\0' + b''.join(n.encode() + b'\0' for n, _ in sections) + b'.shstrtab\0'
    body, headers, offset, name_at = b'', [b'\0' * 64], 64, 1
    for name, data in sections + [('.shstrtab', names)]:
        headers.append(struct.pack('<IIQQQQIIQQ', name_at, 1, 0, 0, offset, len(data), 0, 0, 1, 0))
        name_at += len(name) + 1
        body += data
        offset += len(data)
    header = b'\x7fELF' + bytes([2, 1, 1]) + b'\0' * 9 + struct.pack('<HHIQQQIHHHHHH', 2, 62, 1, 0, 0, offset, 0, 64, 0, 0, 64, len(headers), len(headers) - 1)
    return header + body + b''.join(headers)


def go_binary(deps, version='go1.26.6', extra=()):
    """An ELF executable with Go 1.18+'s inline build information, as the linker writes it."""
    def varint(n):
        out = b''
        while n >= 0x80:
            out += bytes([n & 0x7f | 0x80])
            n >>= 7
        return out + bytes([n])
    info = 'path\tgitea.dev/tea\nmod\tgitea.dev/tea\tv0.16.0\t\n' + ''.join('dep\t%s\t%s\t%s\n' % d for d in deps) + 'build\tGOOS=linux\n'
    mod = b'0' * 16 + info.encode() + b'1' * 16
    header = go_notices.MAGIC + bytes([8, 2])
    section = header + b'\0' * (32 - len(header)) + varint(len(version)) + version.encode() + varint(len(mod)) + mod
    return elf([('.text', b'code'), ('.go.buildinfo', section), *extra])


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
            (inputs / 'ubuntu-packages.json').write_text(json.dumps(dict(platform='ubuntu-24.04', packages=[{k: p[k] for k in ('name', 'version', 'architecture')} for p in packages])))
            wheel = inputs / 'compose.whl'
            with zipfile.ZipFile(wheel, 'w') as z:
                z.writestr('podman_compose.py', 'import sys\nassert sys.argv[1] == "--in-pod=false"\nprint("synthetic-compose")')
                z.writestr('podman_compose-1.5.0.dist-info/licenses/LICENSE', 'synthetic GPL-2.0-only notice')
                z.writestr('podman_compose-1.5.0.dist-info/METADATA', 'synthetic metadata')
            lock = dict(version='1.5.0', filename=wheel.name, sha256=profiles.digest(wheel), deb_dependencies={p['name']: p['version'] for p in packages})
            (inputs / 'artifact-lock.json').write_text(json.dumps(lock))
            with contextlib.redirect_stdout(io.StringIO()):
                profiles.build('containers', inputs, d / 'out', 'linux-amd64')
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
                profiles.build('containers', inputs, d / 'missing-dependency', 'linux-amd64')
            wheel.write_bytes(b'tampered')
            with self.assertRaisesRegex(ValueError, 'compose digest mismatch'):
                profiles.build('containers', inputs, d / 'tampered', 'linux-amd64')

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
            tar_file(inputs / 'uv.tar.gz', {'uv-aarch64-unknown-linux-gnu/uv': 'binary', 'uv-aarch64-unknown-linux-gnu/uvx': 'binary'})
            cargo = '[[package]]\nname="omitted"\nversion="1.0"\nsource="registry+https://github.com/rust-lang/crates.io-index"\nchecksum="' + 'a' * 64 + '"\n'
            tar_file(inputs / 'source.tar.gz', {'uv-1.0/Cargo.lock': cargo})
            lock = d / 'lock.json'
            arm = dict(sha256=profiles.digest(inputs / 'uv.tar.gz'), prefix='uv-aarch64-unknown-linux-gnu')
            lock.write_text(json.dumps(dict(version='1.0', targets={'linux-amd64': dict(sha256='0' * 64, prefix='uv-x86_64-unknown-linux-gnu'), 'linux-arm64': arm}, source=dict(sha256=profiles.digest(inputs / 'source.tar.gz')), crates=[])))
            with self.assertRaisesRegex(ValueError, 'digest mismatch'):
                uv.build(lock, inputs, d / 'amd64', 'linux-amd64')
            with self.assertRaisesRegex(ValueError, 'incomplete Rust source lock'):
                uv.build(lock, inputs, d / 'out', 'linux-arm64')
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
            pin = dict(prefix='pkg', sha256=profiles.digest(archive))
            lock.write_text(json.dumps(dict(name='editor', version='1.0', profile='editor', targets={'linux-amd64': pin, 'linux-arm64': pin}, licenses=['LICENSE'])))
            editor.build(lock, archive, d / 'out', 'linux-arm64')
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
                    profiles.build('test', inputs, d / 'out', 'linux-amd64')


    def test_ubuntu_requirements_resolve_per_target(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as d:
            path = Path(d) / 'ubuntu-packages.json'
            declaration = dict(platform='ubuntu-24.04', packages=[dict(name='git', architecture='native', version='1'), dict(name='adduser', architecture='all', version='2')])
            path.write_text(json.dumps(declaration))
            for target, arch in (('linux-amd64', 'amd64'), ('linux-arm64', 'arm64')):
                self.assertEqual(profiles.ubuntu_requirements(path, target), [dict(name='git', architecture=arch, version='1'), dict(name='adduser', architecture='all', version='2')])
            for bad in (dict(declaration, platform='ubuntu-24.04-amd64'), dict(declaration, packages=[dict(name='git', architecture='amd64', version='1')])):
                path.write_text(json.dumps(bad))
                with self.assertRaisesRegex(ValueError, 'invalid Ubuntu requirement'):
                    profiles.ubuntu_requirements(path, 'linux-arm64')
            path.write_text(json.dumps(declaration))
            with self.assertRaisesRegex(ValueError, 'invalid Ubuntu requirement'):
                profiles.ubuntu_requirements(path, 'linux-armhf')

    def test_target_selection(self):
        records = [dict(name='shared'), dict(name='x', target='linux-amd64'), dict(name='a', target='linux-arm64')]
        self.assertEqual([r['name'] for r in profiles.for_target(records, 'linux-arm64')], ['shared', 'a'])
        with self.assertRaisesRegex(ValueError, 'unsupported target'):
            profiles.for_target(records, 'linux-riscv64')
        with self.assertRaisesRegex(ValueError, 'every target'):
            profiles.target_pin(dict(targets={'linux-amd64': {}}), 'linux-amd64')

    def test_go_notice_is_bound_to_the_binary_modules(self):
        """A lock that changes tea, or one of its modules, needs new notices."""
        deps = [('golang.org/x/net', 'v0.57.0', 'h1:aaa='), ('gopkg.in/yaml.v3', 'v3.0.1', 'h1:bbb=')]
        binary = go_binary(deps)
        notice = 'header\n\nmodules:\n' + go_notices.modules(binary) + go_notices.RULE + '\nx: LICENSE\n' + go_notices.RULE + '\ntext\n'
        go_notices.check(notice, binary)
        for other in (go_binary([deps[0], ('gopkg.in/yaml.v3', 'v3.0.2', 'h1:ccc=')]), go_binary(deps[:1]), go_binary(deps, 'go1.26.7')):
            with self.assertRaisesRegex(ValueError, 'notice_module_mismatch'):
                go_notices.check(notice, other)
        # The section table locates the information; the magic elsewhere, as
        # rclone carries it, is ordinary data.
        decoy = go_binary(deps, extra=[('.noptrdata', go_notices.MAGIC + b'\0\0Authorization: ')])
        go_notices.check(notice, decoy)
        twice = go_binary(deps, extra=[('.go.buildinfo', b'')])
        for unreadable in (b'no build information', elf([('.text', b'code')]), twice, binary[:-64]):
            with self.assertRaisesRegex(ValueError, 'go_buildinfo_unreadable'):
                go_notices.check(notice, unreadable)
        self.assertTrue(go_notices.is_go(binary))
        self.assertFalse(go_notices.is_go(elf([('.text', b'code')])))
        self.assertFalse(go_notices.is_go(b'#!/bin/sh\n'))
        # A stripped section table must not pass a Go executable off as non-Go.
        sectionless = bytearray(binary)
        sectionless[0x28:0x30] = bytes(8)
        sectionless[0x3c:0x40] = bytes(4)
        with self.assertRaisesRegex(ValueError, 'go_buildinfo_unreadable'):
            go_notices.is_go(bytes(sectionless))

    def test_raw_go_tool_is_digest_and_notice_checked(self):
        deps = [('golang.org/x/net', 'v0.57.0', 'h1:aaa=')]
        binary = go_binary(deps)
        notice = 'header\n\nmodules:\n' + go_notices.modules(binary) + go_notices.RULE + '\n'
        with tempfile.TemporaryDirectory(dir='/var/tmp') as d:
            inputs = Path(d)
            (inputs / 'tea-bin').write_bytes(binary)
            (inputs / 'tea-NOTICES').write_text(notice)
            digest = profiles.digest(inputs / 'tea-bin')
            tool = dict(name='tea', version='0.16.0', archive='tea-bin', member=None, sha256=digest, license_files=['tea-NOTICES'], go_notices='tea-NOTICES')
            lock = dict(inputs=[dict(filename='tea-bin', sha256=digest)], tools=[tool])
            written = {}
            def put(data, dest, owner, executable=False):
                written[dest] = (data, executable)
            integrations_build.add_tools(lock, inputs, put, [], 'linux-amd64')
            self.assertEqual(written['runtime/bin/tea'], (binary, True))
            self.assertEqual(written['licenses/tea/NOTICES'][0], notice.encode())
            (inputs / 'tea-NOTICES').write_text(notice.replace('v0.57.0', 'v0.56.0'))
            with self.assertRaisesRegex(ValueError, 'notice_module_mismatch'):
                integrations_build.add_tools(lock, inputs, put, [], 'linux-amd64')
            # A Go tool cannot ship with only its top-level licence.
            (inputs / 'tea-LICENSE').write_text('MIT')
            lock['inputs'].append(dict(filename='tea-LICENSE', sha256=profiles.digest(inputs / 'tea-LICENSE')))
            tool.update(license_files=['tea-LICENSE'])
            del tool['go_notices']
            with self.assertRaisesRegex(ValueError, 'go_notices_required: tea'):
                integrations_build.add_tools(lock, inputs, put, [], 'linux-amd64')
            # A tool the Go toolchain did not link needs none.
            (inputs / 'tea-bin').write_bytes(elf([('.text', b'code')]))
            tool['sha256'] = lock['inputs'][0]['sha256'] = profiles.digest(inputs / 'tea-bin')
            integrations_build.add_tools(lock, inputs, put, [], 'linux-amd64')

    def test_checked_in_locks_pin_every_target_at_one_version(self):
        """Both targets of a profile ship the same upstream versions."""
        runtime = Path(__file__).resolve().parent.parent / 'runtime'
        core = json.loads((runtime / 'core/artifact-lock.json').read_text())
        integrations = json.loads((runtime / 'profiles/integrations/artifact-lock.json').read_text())
        self.assertEqual(core['node'], integrations['node'])
        for profile in ('integrations', 'browser', 'python'):
            lock = json.loads((runtime / 'profiles' / profile / 'artifact-lock.json').read_text())
            for key in ('inputs', 'tools'):
                # Integrations inputs are named by upstream file; count them.
                versions = {t: sorted((r.get('name', ''), r.get('version', '')) for r in profiles.for_target(lock.get(key, []), t) if r.get('kind') != 'notice') for t in profiles.TARGETS}
                self.assertEqual(versions['linux-amd64'], versions['linux-arm64'], profile + ' ' + key)
        for profile in ('editor', 'uv'):
            lock = json.loads((runtime / 'profiles' / profile / 'artifact-lock.json').read_text())
            for target in profiles.TARGETS:
                self.assertIn(lock['version'], profiles.target_pin(lock, target)['url'])


if __name__ == '__main__':
    unittest.main()
