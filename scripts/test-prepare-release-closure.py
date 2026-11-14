#!/usr/bin/env python3
"""Offline cache identity, publication, native-build and verifier regressions."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prepare', Path(__file__).with_name('prepare-release-closure.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
for name in subprocess.check_output(['git', 'rev-parse', '--local-env-vars'], text=True).split():
    os.environ.pop(name, None)


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        self.git('init', '-q')
        self.git('config', 'user.name', 'Test')
        self.git('config', 'user.email', 'test@example.invalid')
        for name in ('runtime/core/artifact-lock.json', 'runtime/profiles/integrations/package-lock.json',
                     'scripts/download-profile-inputs.py', 'scripts/go-binary-notices.py',
                     'scripts/build-core-runtime.sh', 'scripts/test-profile-runtime-build.py', 'product'):
            path = self.repo / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('one')
        self.commit()
        self.cache = self.root / 'cache'
        self.calls = []

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], text=True).strip()

    def commit(self):
        self.git('add', '.')
        self.git('commit', '-qm', 'synthetic inputs')
        self.head = self.git('rev-parse', 'HEAD')

    def fake_run(self, *args):
        args = [str(a) for a in args]
        self.calls.append(args)
        if args[1] == 'manifest':
            output = Path(args[args.index('--directory') + 1])
            artifacts = json.loads((output / 'artifacts.json').read_text())
            for artifact in artifacts:
                if hashlib.sha256((output / artifact['archive']).read_bytes()).hexdigest() != artifact['sha256']:
                    raise ValueError('digest mismatch')
            (output / 'release.json').write_text(json.dumps({
                'version': args[args.index('--version') + 1],
                'commit': args[args.index('--commit') + 1], 'artifacts': artifacts}))
        else:
            output = Path(args[-1])
            output.mkdir()
            profile = 'core' if 'build-core' in args[0] else 'integrations'
            raw = profile.encode()
            (output / (profile + '.tar.gz')).write_bytes(raw)
            (output / 'artifact.json').write_text(json.dumps({
                'archive': profile + '.tar.gz', 'sha256': hashlib.sha256(raw).hexdigest()}))
            (output / 'build-scratch').write_text('do not cache')

    def prepare(self, output='out', target='linux-arm64', version='0.0.0-test.1'):
        with patch.object(module, 'run', self.fake_run), patch.object(module.platform, 'machine', return_value='aarch64'), patch.object(module.platform, 'system', return_value='Linux'):
            module.prepare(self.repo, self.cache, self.root / output,
                           Path('/synthetic/runtime-release'), target, version, self.head)

    def test_content_key_matches_cut_selection(self):
        original = module.runtime_key(self.repo, self.head)
        for name in ('product', 'scripts/test-profile-runtime-build.py'):
            (self.repo / name).write_text('two')
            self.commit()
            self.assertEqual(original, module.runtime_key(self.repo, self.head))
        for name in ('runtime/core/artifact-lock.json', 'runtime/profiles/integrations/package-lock.json',
                     'scripts/download-profile-inputs.py', 'scripts/go-binary-notices.py', 'scripts/build-core-runtime.sh'):
            previous = module.runtime_key(self.repo, self.head)
            (self.repo / name).write_text('two')
            self.commit()
            self.assertNotEqual(previous, module.runtime_key(self.repo, self.head))
        (self.repo / 'scripts/go-binary-notices.py').unlink()
        self.commit()
        self.assertNotEqual(previous, module.runtime_key(self.repo, self.head))

    def test_modes_invalidate_and_helper_does_not(self):
        previous = module.runtime_key(self.repo, self.head)
        (self.repo / 'runtime/core/artifact-lock.json').chmod(0o755)
        self.commit()
        self.assertNotEqual(previous, module.runtime_key(self.repo, self.head))
        previous = module.runtime_key(self.repo, self.head)
        (self.repo / 'scripts/prepare-release-closure.py').write_text('orchestration only')
        self.commit()
        self.assertEqual(previous, module.runtime_key(self.repo, self.head))

    def test_build_reads_committed_snapshot_not_moving_checkout(self):
        original = self.fake_run
        def moving(*args):
            if 'build-core' in str(args[0]):
                (self.repo / 'runtime/core/artifact-lock.json').write_text('modified')
                self.commit()
                source = Path(args[0]).parent.parent
                self.assertEqual((source / 'runtime/core/artifact-lock.json').read_text(), 'one')
            original(*args)
        self.fake_run = moving
        old_key = module.runtime_key(self.repo, self.head)
        self.prepare()
        self.assertTrue((self.cache / ('linux-arm64-' + old_key)).is_dir())

    def test_reuse_rewrites_identity_and_verifies_every_time(self):
        self.prepare()
        self.assertEqual(len(self.calls), 3)
        self.assertFalse(list(self.cache.rglob('build-scratch')))
        (self.repo / 'product').write_text('new product')
        self.commit()
        self.prepare('next', version='0.0.0-test.2')
        self.assertEqual(len(self.calls), 4)
        manifest = json.loads((self.root / 'next/release.json').read_text())
        self.assertEqual(manifest['commit'], self.head)
        self.assertEqual(manifest['version'], '0.0.0-test.2')
        self.assertEqual(sorted(p.name for p in (self.root / 'next').iterdir()),
                         ['core.tar.gz', 'integrations.tar.gz', 'release.json'])
        next(self.cache.glob('linux-arm64-*/core/core.tar.gz')).write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError, 'digest mismatch'):
            self.prepare('corrupt')
        self.assertFalse((self.root / 'corrupt').exists())

    def test_foreign_miss_refuses_but_transferred_cache_verifies(self):
        with self.assertRaisesRegex(ValueError, 'native linux-amd64'):
            self.prepare(target='linux-amd64')
        self.assertEqual(self.calls, [])
        self.prepare()
        entry = next(p for p in self.cache.glob('linux-arm64-*') if p.is_dir())
        entry.rename(entry.with_name(entry.name.replace('arm64', 'amd64')))
        self.prepare('foreign', target='linux-amd64')
        self.assertEqual(len(self.calls), 4)
        self.assertIn('ubuntu-24.04-amd64', self.calls[-1])

    def test_failed_verification_does_not_publish_cache_or_output(self):
        original = self.fake_run
        def fail(*args):
            if str(args[1]) == 'manifest':
                raise ValueError('closure refused')
            original(*args)
        self.fake_run = fail
        with self.assertRaisesRegex(ValueError, 'closure refused'):
            self.prepare()
        self.assertFalse((self.root / 'out').exists())
        self.assertEqual([p for p in self.cache.iterdir() if p.is_dir()], [])


if __name__ == '__main__':
    unittest.main()
