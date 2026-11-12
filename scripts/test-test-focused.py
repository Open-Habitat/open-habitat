#!/usr/bin/env python3
"""Exercise the focused shell/Python entrypoint without building or launching browsers."""
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time
import unittest

REPO = Path(__file__).resolve().parent.parent


class FocusedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='oh-focused-test-', dir='/var/tmp')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.log = self.root / 'calls.jsonl'
        npx = self.root / 'npx'
        npx.write_text('''#!/usr/bin/env python3
import json, os, sys
with open(os.environ['FOCUSED_CALLS'], 'a') as out:
    out.write(json.dumps(sys.argv[1:]) + '\\n')
with open(os.environ['FOCUSED_ENV'], 'w') as out:
    json.dump({key: os.environ.get(key) for key in ('OH_REPLY_DELAY_MS', 'OH_REPLY_SEED', 'TMPDIR', 'PYTHON', 'PATH')}, out)
with open(os.path.join(os.environ['TMPDIR'], 'left-behind'), 'w') as out:
    out.write('a killed child leaves this\\n')
if os.environ.get('FOCUSED_HANG'):
    import time
    time.sleep(float(os.environ['FOCUSED_HANG']))
sys.exit(int(os.environ.get('FOCUSED_EXIT', '0')))
''')
        npx.chmod(0o700)
        # The Go area runs `go test`; this stand-in behaves like the npx one.
        (self.root / 'go').write_text(npx.read_text())
        (self.root / 'go').chmod(0o700)
        # A fresh checkout's Go area installs the Pi SDK; never reach npm here.
        (self.root / 'npm').write_text('#!/bin/sh\nexit 0\n')
        (self.root / 'npm').chmod(0o700)
        self.scratch = self.root / 'scratch'
        self.scratch.mkdir()
        (self.scratch / '.lease').touch()
        self.env = {**os.environ, 'PATH': str(self.root) + os.pathsep + os.environ['PATH'],
                    'FOCUSED_CALLS': str(self.log),
                    'FOCUSED_ENV': str(self.root / 'env.json'),
                    'OH_BROWSER_SUITE_LOCK': str(self.root / 'suite.lock'),
                    'OH_SCRATCH_ROOT': str(self.scratch),
                    # A given interpreter skips building the pinned venv.
                    'PYTHON': '/oh-test/bin/python'}
        self.env.pop('OH_REPLY_DELAY_MS', None)
        self.env.pop('OH_REPLY_SEED', None)

    def run_focused(self, *args, status=0):
        result = subprocess.run([str(REPO / 'scripts/test-focused.sh'), '--area', 'browser', *args],
                                env=self.env, text=True, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, status, result.stderr)
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def test_repeated_specs_and_tag(self):
        self.assertEqual(self.run_focused('--spec', 'github-first-onboarding.spec.ts',
                                         '--spec', 'host-lifetime.spec.ts', '--tag', '@focused'),
                         [['playwright', 'test', 'tests/github-first-onboarding.spec.ts',
                           'tests/host-lifetime.spec.ts', '--grep', '@focused']])

    def test_every_spec_validated_before_launch(self):
        for invalid in ('../escape.spec.ts', '', 'nonexistent-focused.spec.ts', 'synthetic-demo.spec.ts'):
            with self.subTest(invalid=invalid):
                self.assertEqual(self.run_focused('--spec', invalid, '--spec', 'host-lifetime.spec.ts',
                                                 status=2), [])

    def test_mixed_configs_continue_after_failure(self):
        self.env['FOCUSED_EXIT'] = '7'
        self.assertEqual(self.run_focused('--spec', 'host-lifetime.spec.ts',
                                         '--spec', 'lab-conversation.spec.ts', status=7),
                         [['playwright', 'test', 'tests/host-lifetime.spec.ts'],
                          ['playwright', 'test', '--config', 'playwright.lab.config.ts',
                           'tests/lab-conversation.spec.ts']])

    def test_lab_specs_together(self):
        self.assertEqual(self.run_focused('--lab', '--spec', 'lab-conversation.spec.ts',
                                         '--spec', 'lab-foundation.spec.ts'),
                         [['playwright', 'test', '--config', 'playwright.lab.config.ts',
                           'tests/lab-conversation.spec.ts', 'tests/lab-foundation.spec.ts']])

    def test_single_spec(self):
        self.assertEqual(self.run_focused('--spec', 'host-lifetime.spec.ts'),
                         [['playwright', 'test', 'tests/host-lifetime.spec.ts']])

    def test_tag_only(self):
        self.assertEqual(self.run_focused('--tag', '@focused'),
                         [['playwright', 'test', '--grep', '@focused']])

    def test_focused_jitter_default_and_overrides(self):
        for selection in (('--spec', 'host-lifetime.spec.ts'), ('--tag', '@focused')):
            for override in (None, '0', '250'):
                with self.subTest(selection=selection, override=override):
                    self.env.pop('OH_REPLY_DELAY_MS', None)
                    if override is not None:
                        self.env['OH_REPLY_DELAY_MS'] = override
                    self.env['OH_REPLY_SEED'] = 'focused-replay'
                    self.run_focused(*selection)
                    observed = json.loads((self.root / 'env.json').read_text())
                    observed = {k: observed[k] for k in ('OH_REPLY_DELAY_MS', 'OH_REPLY_SEED')}
                    self.assertEqual(observed, {'OH_REPLY_DELAY_MS': override or '60',
                                                'OH_REPLY_SEED': 'focused-replay'})

    def observed_tmp(self):
        return Path(json.loads((self.root / 'env.json').read_text())['TMPDIR'])

    def assert_scratch_removed(self, prefix):
        run_tmp = self.observed_tmp()
        # Go's sockets need a TMPDIR of at most 21 bytes, which this fixture's
        # scratch root is too long to give; that run falls back to /var/tmp.
        self.assertEqual(run_tmp.parent, self.scratch if prefix == 'ohb' else Path('/var/tmp'))
        self.assertLessEqual(len(str(run_tmp)), 21 if prefix == 'ohf' else 4096)
        self.assertTrue(run_tmp.name.startswith(prefix + '.'), run_tmp)
        self.assertFalse(run_tmp.exists(), f'{run_tmp} survived the run')
        self.assertEqual(sorted(p.name for p in self.scratch.iterdir()), ['.lease'])

    def run_area(self, area, *args):
        return subprocess.run([str(REPO / 'scripts/test-focused.sh'), '--area', area, *args],
                              env=self.env, text=True, capture_output=True, timeout=10)

    def test_private_tmpdir_removed_on_success_and_failure(self):
        for area, args, prefix in (('browser', ('--tag', '@focused'), 'ohb'),
                                   ('go', ('--go-package', './internal/daemon'), 'ohf')):
            for code in (0, 7):
                with self.subTest(area=area, code=code):
                    self.env['FOCUSED_EXIT'] = str(code)
                    result = self.run_area(area, *args)
                    self.assertEqual(result.returncode, code, result.stderr)
                    self.assert_scratch_removed(prefix)

    def test_go_area_gets_the_validator_python(self):
        result = self.run_area('go', '--go-package', './internal/daemon')
        self.assertEqual(result.returncode, 0, result.stderr)
        seen = json.loads((self.root / 'env.json').read_text())
        self.assertEqual(seen['PYTHON'], '/oh-test/bin/python')
        # Fixtures that run python3 directly find the same interpreter first.
        self.assertEqual(seen['PATH'].split(os.pathsep)[0], '/oh-test/bin')

    def test_private_tmpdir_removed_when_terminated(self):
        # Outlive the signal briefly, as a test child finishing its cleanup does.
        self.env['FOCUSED_HANG'] = '2'
        for area, args, prefix in (('browser', ('--tag', '@focused'), 'ohb'),
                                   ('go', ('--go-package', './internal/daemon'), 'ohf')):
            with self.subTest(area=area):
                (self.root / 'env.json').unlink(missing_ok=True)
                proc = subprocess.Popen([str(REPO / 'scripts/test-focused.sh'), '--area', area, *args],
                                        env=self.env, stdout=subprocess.DEVNULL,
                                        stderr=subprocess.DEVNULL, start_new_session=True)
                deadline = time.monotonic() + 10
                while not (self.root / 'env.json').exists() and time.monotonic() < deadline:
                    time.sleep(0.05)
                self.assertTrue((self.observed_tmp() / 'left-behind').exists())
                # `timeout` signals only the entry script, not its children.
                proc.send_signal(signal.SIGTERM)
                try:
                    self.assertNotEqual(proc.wait(timeout=10), 0)
                    time.sleep(0.2)
                    self.assert_scratch_removed(prefix)
                finally:
                    try:
                        os.killpg(proc.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass

    def test_scratch_root_selection_and_lease(self):
        helper = REPO / 'scripts/scratch.sh'
        probe = (f'set -euo pipefail; source {helper}; oh_scratch_dir d ohx; echo "$d"; '
                 f'if flock -n -x "$(oh_scratch_root)/.lease" true; then echo unleased; fi; rmdir "$d"')
        result = subprocess.run(['bash', '-c', probe], env=self.env, text=True,
                                capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        made = Path(result.stdout.splitlines()[0])
        self.assertEqual(made.parent, self.scratch)
        self.assertNotIn('unleased', result.stdout)
        short = subprocess.run(['bash', '-c', probe.replace('oh_scratch_dir d', 'oh_short_scratch_dir d')],
                               env={**self.env, 'OH_SCRATCH_ROOT': '/var/tmp'}, text=True,
                               capture_output=True, timeout=10)
        self.assertEqual(short.returncode, 0, short.stderr)
        self.assertRegex(short.stdout.splitlines()[0], r'^/var/tmp/ohx\.[^/]{6}$')
        for bad in ('relative', str(self.root / 'missing')):
            with self.subTest(bad=bad):
                result = subprocess.run(['bash', '-c', probe], env={**self.env, 'OH_SCRATCH_ROOT': bad},
                                        text=True, capture_output=True, timeout=10)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('OH_SCRATCH_ROOT', result.stderr)

    def test_whole_suite(self):
        self.assertEqual(self.run_focused(), [['playwright', 'test']])
        observed = json.loads((self.root / 'env.json').read_text())
        self.assertIsNone(observed['OH_REPLY_DELAY_MS'])


if __name__ == '__main__':
    unittest.main()
