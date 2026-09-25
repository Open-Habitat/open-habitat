#!/usr/bin/env python3
"""Exercise the exact guest command function without running the boot proof."""
import ast
import os
from pathlib import Path
import resource
import signal
import subprocess
import sys
import tempfile
import time
import unittest

source = ast.parse((Path(__file__).parent / 'jit-reboot-proof.py').read_text())
function = next(node for node in source.body if isinstance(node, ast.FunctionDef) and node.name == 'command')
namespace = dict(os=os, resource=resource, signal=signal, subprocess=subprocess,
                 tempfile=tempfile)
exec(compile(ast.Module(body=[function], type_ignores=[]), '<guest-command>', 'exec'), namespace)
command = namespace['command']


class GuestCommandTest(unittest.TestCase):
    def test_output_and_exit(self):
        p = command(sys.executable, '-c', 'print("disabled")')
        self.assertEqual((p.returncode, p.stdout.strip()), (0, 'disabled'))

    def test_descendant_holding_output_does_not_block_parent(self):
        # Child exits; its descendant retains stdout for longer than the deadline.
        start = time.monotonic()
        p = command(sys.executable, '-c',
                    'import subprocess,sys;subprocess.Popen([sys.executable,"-c","import time;time.sleep(4)"]);print("disabled")',
                    timeout=0.5)
        self.assertEqual(p.stdout.strip(), 'disabled')
        self.assertLess(time.monotonic()-start, 2)

    def test_timeout_kills_process_group(self):
        with tempfile.TemporaryDirectory() as d:
            pidfile = Path(d) / 'pid'
            with self.assertRaises(TimeoutError):
                command(sys.executable, '-c',
                        'import subprocess,sys,time;subprocess.Popen([sys.executable,"-c","import time;time.sleep(30)"],stdout=sys.stdout);open(sys.argv[1],"w").write(str(__import__("os").getpid()));time.sleep(30)',
                        str(pidfile), timeout=0.2)
            pid = int(pidfile.read_text())
            with self.assertRaises(ProcessLookupError):
                os.kill(pid, 0)

    def test_output_is_bounded(self):
        p = command(sys.executable, '-c', 'print("x"*100000)')
        self.assertLessEqual(len(p.stdout), 4096)


if __name__ == '__main__':
    unittest.main()
