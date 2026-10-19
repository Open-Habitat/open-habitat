#!/usr/bin/env python3
"""Exercise stray detection and explicit cleanup against a disposable fake host."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

SCRIPT = Path(__file__).with_name('browser-hosts.py')


class BrowserHostsTest(unittest.TestCase):
    def test_report_and_kill_orphan(self):
        with tempfile.TemporaryDirectory(prefix='oh-stray-', dir='/var/tmp') as tmp:
            root = Path(tmp) / 'worktree'
            cache = root / '.cache'
            cache.mkdir(parents=True)
            binary = cache / 'browser-host'
            shutil.copy(sys.executable, binary)
            # A short-lived launcher leaves the harmless fake executable orphaned.
            launcher = subprocess.run([sys.executable, '-c', '''
import subprocess, sys
p = subprocess.Popen([sys.argv[1], '-c', 'import time; time.sleep(60)'], executable=sys.argv[1], start_new_session=True,
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL)
print(p.pid)
''', str(binary)], capture_output=True, text=True, check=True)
            pid = int(launcher.stdout)
            def inspect(*args):
                result = subprocess.run([sys.executable, str(SCRIPT), '--json', '--pid', str(pid), *args],
                                        capture_output=True, text=True, check=True)
                return json.loads(result.stdout)['data']['hosts']
            try:
                rows = inspect()
                self.assertEqual(rows[0]['pid'], pid)
                self.assertIn('parent-init-or-systemd', rows[0]['reasons'])
                self.assertFalse(rows[0]['killed'])
                os.kill(pid, 0)  # report did not kill
                binary.unlink()
                cache.rmdir()
                root.rmdir()
                self.assertIn('worktree-missing', inspect()[0]['reasons'])
                self.assertTrue(inspect('--kill')[0]['killed'])
                deadline = time.monotonic() + 3
                while time.monotonic() < deadline and inspect():
                    time.sleep(.05)
                self.assertEqual(inspect(), [])
            finally:
                try:
                    os.kill(pid, 9)
                except ProcessLookupError:
                    pass

    def test_live_host_is_not_stray(self):
        with tempfile.TemporaryDirectory(prefix='oh-owned-', dir='/var/tmp') as tmp:
            cache = Path(tmp) / '.cache'
            cache.mkdir()
            binary = cache / 'browser-host'
            shutil.copy(sys.executable, binary)
            with subprocess.Popen([str(binary), '-c', 'import time; time.sleep(60)'], executable=str(binary)) as child:
                try:
                    result = subprocess.run([sys.executable, str(SCRIPT), '--kill', '--json', '--pid', str(child.pid)],
                                            capture_output=True, text=True, check=True)
                    self.assertEqual(json.loads(result.stdout)['data']['hosts'], [])
                    self.assertIsNone(child.poll())
                finally:
                    child.kill()


if __name__ == '__main__':
    unittest.main()
