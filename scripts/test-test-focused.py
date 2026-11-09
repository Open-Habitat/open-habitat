#!/usr/bin/env python3
"""Exercise the focused shell/Python entrypoint without building or launching browsers."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
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
sys.exit(int(os.environ.get('FOCUSED_EXIT', '0')))
''')
        npx.chmod(0o700)
        self.env = {**os.environ, 'PATH': str(self.root) + os.pathsep + os.environ['PATH'],
                    'FOCUSED_CALLS': str(self.log),
                    'OH_BROWSER_SUITE_LOCK': str(self.root / 'suite.lock')}

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

    def test_whole_suite(self):
        self.assertEqual(self.run_focused(), [['playwright', 'test']])


if __name__ == '__main__':
    unittest.main()
