#!/usr/bin/env python3
"""Synthetic browser archive boundary regressions; no native-browser claim."""
import ast
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
import zipfile

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('browser', HERE / 'browser-runtime-build.py')
browser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(browser)


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


class BrowserBuild(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir='/var/tmp')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.inputs = self.base / 'inputs'
        self.inputs.mkdir()
        self.common_notice = b'notice'
        self.records = []
        for name in ['playwright', 'greenlet', 'pyee', 'typing-extensions', 'chromium-headless-shell']:
            is_browser = name == 'chromium-headless-shell'
            p = dict(name=name, version='1', kind='browser' if is_browser else 'wheel', filename=name + '.zip', prefix='shell', revision='123')
            members = {'shell/chrome-headless-shell': b'native', 'shell/LICENSE.headless_shell': b'notice', 'shell/ABOUT': b'terms reference'} if is_browser else {name + '-1.dist-info/METADATA': b'Version: 1\n', name + '-1.dist-info/licenses/LICENSE': b'notice'}
            if name == 'playwright':
                members['playwright/driver/package/browsers.json'] = json.dumps(dict(browsers=[dict(name='chromium-headless-shell', revision='123', browserVersion='1')])).encode()
            self.write_zip(p, members)
            self.records.append(p)

    def write_zip(self, p, members):
        with zipfile.ZipFile(self.inputs / p['filename'], 'w') as z:
            for name, data in members.items():
                z.writestr(name, data)
        p['sha256'] = digest(self.inputs / p['filename'])

    def build(self):
        lock = self.inputs / 'artifact-lock.json'
        lock.write_text(json.dumps(dict(inputs=self.records, common_license_sha256={'MIT': hashlib.sha256(b'notice').hexdigest()})))
        root = self.base / 'payload'
        (root / 'licenses/common').mkdir(parents=True)
        (root / 'licenses/common/MIT').write_bytes(self.common_notice)
        owners, components = {'licenses/common/MIT': 'common-licenses'}, []
        browser.add_browser(lock, self.inputs, root, owners, components, digest)
        return root, owners, components

    def test_complete_notice_inventory_and_modes(self):
        old = os.umask(0o077)
        try:
            root, owners, components = self.build()
        finally:
            os.umask(old)
        self.assertEqual(len(components), 5)
        self.assertIn('runtime/browsers/chromium_headless_shell-123/shell/ABOUT', components[-1]['license_files'])
        self.assertEqual((root / 'runtime/browsers/chromium_headless_shell-123/shell/chrome-headless-shell').stat().st_mode & 0o777, 0o755)
        self.assertTrue(all((root / f).is_file() for c in components for f in c['license_files']))
        self.assertEqual(set(owners), {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()})

    def test_builder_notice_drift(self):
        self.common_notice = b'different builder OS'
        with self.assertRaisesRegex(ValueError, 'common licence bytes differ'):
            self.build()

    def test_missing_dependency(self):
        self.records.pop(1)
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            self.build()

    def test_tampered_bytes(self):
        (self.inputs / self.records[0]['filename']).write_bytes(b'tamper')
        with self.assertRaisesRegex(ValueError, 'digest'):
            self.build()

    def test_browser_version_mismatch(self):
        self.records[-1]['revision'] = '124'
        with self.assertRaisesRegex(ValueError, 'version mismatch'):
            self.build()

    def test_escaping_zip(self):
        self.write_zip(self.records[0], {'../escape': b'bad'})
        with self.assertRaisesRegex(ValueError, 'unsafe ZIP'):
            self.build()

    def test_no_browser_notice(self):
        self.write_zip(self.records[-1], {'shell/chrome-headless-shell': b'native', 'shell/ABOUT': b'terms reference'})
        with self.assertRaisesRegex(ValueError, 'license_unverified'):
            self.build()

    def test_embedded_python_compiles(self):
        tree = ast.parse((HERE.parent / 'test/vm/profile-runtime-proof.py').read_text())
        scripts = next(n.value for n in ast.walk(tree) if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'scripts' for t in n.targets))
        script = ast.literal_eval(scripts)['browser']
        compile(script.split("<<'PYBROWSER'\n")[1].split('\nPYBROWSER')[0], '<browser-probe>', 'exec')


if __name__ == '__main__':
    unittest.main()
