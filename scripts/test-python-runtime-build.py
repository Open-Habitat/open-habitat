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
    def fixture(self, d, missing_notice=False, escape=False):
        lock = copy.deepcopy(json.loads(LOCK.read_text()))
        # Wheels are qualification data, not needed for archive-policy tests.
        lock['inputs'] = [a for a in lock['inputs'] if a.get('kind') != 'wheel']
        records = {a['name']: a for a in lock['inputs']}
        downloads = {}
        for name, a in records.items():
            if name in ('runtime', 'full', 'build-source'):
                continue
            files = {'source/LICENSE': b'notice'}
            if a.get('supplemental_notice'):
                files[a['supplemental_notice']] = b'native library notice'
            archive(d / a['filename'], files)
            a['sha256'] = hashlib.sha256((d / a['filename']).read_bytes()).hexdigest()
            downloads[name] = {k: a[k] for k in ('sha256', 'version', 'url', 'license_file')}
        build = records['build-source']
        prefix = 'python-build-standalone-' + build['version'] + '/'
        archive(d / build['filename'], {prefix + 'pythonbuild/downloads.py': ('DOWNLOADS = ' + repr(downloads)).encode()})
        metadata = dict(python_version='3.14.4', target_triple='x86_64-unknown-linux-gnu', license_path='licenses/LICENSE.cpython.txt', build_info={'extensions': [{'license_paths': ['licenses/LICENSE.zstd.txt', 'licenses/LICENSE.zlib-ng.txt']}]})
        files = {'python/PYTHON.json': json.dumps(metadata).encode()}
        if not missing_notice:
            files['python/licenses/LICENSE.cpython.txt'] = b'Python licence'
        archive(d / records['full']['filename'], files)
        archive(d / records['runtime']['filename'], {'python/bin/python3.14': b'not executed'}, {'python/bin/python3': '/etc/passwd' if escape else 'python3.14'})
        for a in records.values():
            a['sha256'] = hashlib.sha256((d / a['filename']).read_bytes()).hexdigest()
        p = d / 'artifact-lock.json'
        p.write_text(json.dumps(lock))
        return p, lock

    def test_normalization_and_source_retention(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, lock = self.fixture(d)
            builder.build(p, d, d / 'out')
            a = json.loads((d / 'out/artifact.json').read_text())
            self.assertEqual(a['requires'], ['uv'])
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
            with self.assertRaisesRegex(ValueError, 'missing Python licences'):
                builder.build(p, d, d / 'out')

    def test_missing_native_source(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, lock = self.fixture(d)
            lock['inputs'] = [a for a in lock['inputs'] if a['name'] != 'bdb']
            p.write_text(json.dumps(lock))
            with self.assertRaises(KeyError):
                builder.build(p, d, d / 'out')

    def test_tampered_input(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, lock = self.fixture(d)
            (d / lock['inputs'][0]['filename']).write_bytes(b'tampered')
            with self.assertRaisesRegex(ValueError, 'locked input mismatch'):
                builder.build(p, d, d / 'out')

    def test_escaping_runtime_alias(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            d = Path(temp)
            p, _ = self.fixture(d, escape=True)
            with self.assertRaises((ValueError, tarfile.FilterError)):
                builder.build(p, d, d / 'out')


if __name__ == '__main__':
    unittest.main()
