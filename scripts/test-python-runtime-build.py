#!/usr/bin/env python3
"""Synthetic archive regressions: no network, real homes or fetched executables."""
import copy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('python_builder', Path(__file__).with_name('python-runtime-build.py'))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
LOCK = Path(__file__).resolve().parent.parent / 'runtime/profiles/python/artifact-lock.json'


def archive(path, files, links=None):
    with tarfile.open(path, 'w:gz') as tar:
        for name, data in files.items():
            member = tarfile.TarInfo(name)
            member.mode = 0o755 if '/bin/' in name else 0o644
            member.size = len(data)
            tar.addfile(member, io.BytesIO(data))
        for name, target in (links or {}).items():
            member = tarfile.TarInfo(name)
            member.type = tarfile.SYMTYPE
            member.linkname = target
            tar.addfile(member)


class PythonBuilderTests(unittest.TestCase):
    def fixture(self, d, missing_notice=False, escape=False, empty_notice=False, unlocked=False, missing_source_notice=False, target='linux-amd64', triple=None):
        lock = copy.deepcopy(json.loads(LOCK.read_text()))
        # The fixture writes one target's upstream archives under their lock names.
        lock['inputs'] = builder.profiles.for_target(lock['inputs'], target)
        # Small synthetic wheels exercise licence ownership without executing code.
        for a in lock['inputs']:
            if a.get('kind') == 'wheel':
                with zipfile.ZipFile(d / a['filename'], 'w') as wheel:
                    wheel.writestr(a['name'] + '.dist-info/licenses/LICENSE', 'wheel notice')
        records = {a['name']: a for a in lock['inputs']}
        downloads = {}
        for name, a in records.items():
            if name in ('runtime', 'full', 'build-source') or a.get('kind') == 'wheel':
                continue
            files = {'source/LICENSE': b'notice'}
            if a.get('supplemental_notice'):
                files[a['supplemental_notice']] = b'native library notice'
            archive(d / a['filename'], files)
            a['sha256'] = hashlib.sha256((d / a['filename']).read_bytes()).hexdigest()
            downloads[name] = {k: a[k] for k in ('sha256', 'version', 'url', 'license_file')}
        build = records['build-source']
        prefix = 'python-build-standalone-' + build['version'] + '/'
        archive(d / build['filename'], {prefix + 'pythonbuild/downloads.py': ('DOWNLOADS = ' + repr(downloads)).encode(), prefix + 'LICENSE': b'build-source licence'})
        metadata = dict(python_version='3.14.4', target_triple=triple or builder.TRIPLES[target], license_path='licenses/LICENSE.cpython.txt', build_info={'extensions': [{'license_paths': ['licenses/LICENSE.zstd.txt', 'licenses/LICENSE.zlib-ng.txt']}]})
        if unlocked:
            metadata['build_info']['extensions'].append({'license_paths': ['licenses/LICENSE.new-library.txt']})
        files = {'python/PYTHON.json': json.dumps(metadata).encode()}
        for a in records.values():
            if a.get('license_file') and not a.get('supplemental_notice'):
                files['python/licenses/' + a['license_file']] = b'native notice'
        if missing_notice:
            del files['python/licenses/LICENSE.cpython.txt']
        if missing_source_notice:
            del files['python/licenses/LICENSE.bzip2.txt']
        archive(d / records['full']['filename'], files)
        runtime = {'python/bin/python3.14': b'not executed'}
        if empty_notice:
            runtime['python/lib/LICENSE.txt'] = b''
        archive(d / records['runtime']['filename'], runtime, {'python/bin/python3': '/etc/passwd' if escape else 'python3.14'})
        for a in records.values():
            a['sha256'] = hashlib.sha256((d / a['filename']).read_bytes()).hexdigest()
        p = d / 'artifact-lock.json'
        p.write_text(json.dumps(lock))
        return p, lock

    def test_normalization_and_source_retention(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, lock = self.fixture(d)
            builder.build(p, d, d / 'out', 'linux-amd64')
            a = json.loads((d / 'out/artifact.json').read_text())
            self.assertEqual(a['requires'], ['uv'])
            components = {c['name']: c for c in a['closure']['components']}
            self.assertEqual(components['cpython']['version'], '3.14.4+20260414')
            self.assertEqual(components['MarkupSafe']['version'], '3.0.4')
            self.assertEqual(components['libyaml']['version'], '0.2.5')
            files = {f['path']: f for f in a['closure']['files']}
            for c in components.values():
                self.assertTrue(c['license_files'])
                self.assertTrue(all(files[p]['component'] == c['name'] for p in c['license_files']))
            with tarfile.open(d / 'out/python.tar.gz') as tar:
                self.assertTrue(all(f.isfile() for f in tar))
                self.assertEqual(tar.extractfile('runtime/bin/python3').read(), b'not executed')
                self.assertEqual(tar.getmember('runtime/bin/python3').mode, 0o755)
                self.assertIn('sources/' + next(a['filename'] for a in lock['inputs'] if a['name'] == 'bdb'), tar.getnames())
                self.assertTrue(tar.extractfile('licenses/LICENSE.zstd.txt').read())

    def test_missing_referenced_licence(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, _ = self.fixture(d, missing_notice=True)
            with self.assertRaisesRegex(ValueError, 'native notice missing|missing Python licences'):
                builder.build(p, d, d / 'out', 'linux-amd64')

    def test_missing_native_source(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, lock = self.fixture(d)
            lock['inputs'] = [a for a in lock['inputs'] if a['name'] != 'bdb']
            p.write_text(json.dumps(lock))
            with self.assertRaises(KeyError):
                builder.build(p, d, d / 'out', 'linux-amd64')

    def test_upstream_reference_cannot_omit_source(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, _ = self.fixture(d, unlocked=True)
            with self.assertRaisesRegex(ValueError, 'unlocked native source'):
                builder.build(p, d, d / 'out', 'linux-amd64')

    def test_source_notice_even_when_metadata_omits_it(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, _ = self.fixture(d, missing_source_notice=True)
            with self.assertRaisesRegex(ValueError, 'native notice missing: bzip2'):
                builder.build(p, d, d / 'out', 'linux-amd64')

    def test_empty_runtime_notice(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, _ = self.fixture(d, empty_notice=True)
            with self.assertRaisesRegex(ValueError, 'empty Python notice'):
                builder.build(p, d, d / 'out', 'linux-amd64')

    def test_tampered_input(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, lock = self.fixture(d)
            (d / lock['inputs'][0]['filename']).write_bytes(b'tampered')
            with self.assertRaisesRegex(ValueError, 'locked input mismatch'):
                builder.build(p, d, d / 'out', 'linux-amd64')

    def test_escaping_runtime_alias(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, _ = self.fixture(d, escape=True)
            with self.assertRaises((ValueError, tarfile.FilterError)):
                builder.build(p, d, d / 'out', 'linux-amd64')


    def test_arm64_target(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, _ = self.fixture(d, target='linux-arm64')
            builder.build(p, d, d / 'out', 'linux-arm64')
            self.assertEqual(json.loads((d / 'out/artifact.json').read_text())['profile'], 'python')

    def test_runtime_for_another_target(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, _ = self.fixture(d, target='linux-arm64', triple='x86_64-unknown-linux-gnu')
            with self.assertRaisesRegex(ValueError, 'wrong Python target'):
                builder.build(p, d, d / 'out', 'linux-arm64')


    def test_wheel_for_another_platform(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, lock = self.fixture(d, target='linux-arm64')
            wheel = next(a for a in lock['inputs'] if a.get('kind') == 'wheel' and a['name'] == 'PyYAML')
            # The amd64 wheel's name under the arm64 lock.
            wrong = wheel['filename'].replace('aarch64', 'x86_64')
            (d / wheel['filename']).rename(d / wrong)
            wheel['filename'] = wrong
            p.write_text(json.dumps(lock))
            with self.assertRaisesRegex(ValueError, 'wheel for another platform'):
                builder.build(p, d, d / 'out', 'linux-arm64')


if __name__ == '__main__':
    unittest.main()
