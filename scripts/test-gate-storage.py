#!/usr/bin/env python3
"""Cleanup's deletion boundary, evidence retention and real shell failure exit."""
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import time
import unittest

SOURCE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('gate_storage', SOURCE / 'gate-storage.py')
storage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(storage)


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR', '/var/tmp'))
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'checkout'
        self.repo.mkdir()
        self.env = os.environ.copy()
        for name in subprocess.check_output(['git', 'rev-parse', '--local-env-vars'], text=True).split():
            self.env.pop(name, None)
        subprocess.run(['git', 'init', '-q', str(self.repo)], env=self.env, check=True)
        shutil.copy(SOURCE.parent / '.gitignore', self.repo)
        (self.repo / 'scripts').mkdir()
        for name in ('ci-local.sh', 'gate-storage.py', 'scratch.sh'):
            shutil.copy(SOURCE / name, self.repo / 'scripts' / name)
        (self.repo / 'scripts/browser-hosts.py').write_text('print("synthetic host diagnostic")\n')
        for name in storage.OUTPUTS + storage.CACHES + storage.BROWSER_EVIDENCE:
            self.put(name + '/sentinel')
        self.put('.cache/unrelated/keep')
        self.put('notes.txt')
        self.put('.git/open-habitat-gate-receipts/tree.json')
        self.put('.git/open-habitat-gate-failure/old.log')
        self.shared = self.root / 'shared-cache'
        self.shared.mkdir()
        (self.shared / 'keep').write_text('shared')

    def put(self, name):
        path = self.repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('evidence')
        return path

    def run_gate(self, *args, **env):
        return subprocess.run(['bash', 'scripts/ci-local.sh', *args], cwd=self.repo,
                              env={**self.env, **env}, text=True, capture_output=True, timeout=30)

    def test_finished_clone_cleanup_is_narrow_and_repeatable(self):
        result = self.run_gate('--cleanup', '--json', '--dry-run')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)['data']['dry_run'])
        self.assertTrue((self.repo / 'web/node_modules/sentinel').exists())
        for _ in range(2):
            result = self.run_gate('--cleanup', '--json')
            self.assertEqual(result.returncode, 0, result.stderr)
        for name in storage.OUTPUTS + storage.CACHES:
            self.assertFalse((self.repo / name).exists(), name)
        for name in storage.BROWSER_EVIDENCE + ('.cache/unrelated', 'notes.txt',
                '.git/open-habitat-gate-receipts/tree.json', '.git/open-habitat-gate-failure/old.log'):
            self.assertTrue((self.repo / name).exists(), name)
        self.assertEqual((self.shared / 'keep').read_text(), 'shared')

    def test_success_removes_browser_evidence_but_can_keep_development_caches(self):
        storage.remove(storage.plan(self.repo, keep_caches=True, success=True))
        for name in storage.OUTPUTS + storage.BROWSER_EVIDENCE:
            self.assertFalse((self.repo / name).exists(), name)
        for name in storage.CACHES:
            self.assertTrue((self.repo / name / 'sentinel').exists())

    def test_refuses_symlink_target_or_ancestor_before_any_deletion(self):
        for name in ('web/node_modules', '.cache'):
            with self.subTest(name=name):
                path = self.repo / name
                shutil.rmtree(path)
                path.symlink_to(self.shared, target_is_directory=True)
                result = self.run_gate('--cleanup', '--json')
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('symlink', result.stderr)
                self.assertTrue((self.repo / 'dist/sentinel').exists())
                self.assertTrue((self.shared / 'keep').exists())
                path.unlink()
                path.mkdir()

    def test_tracked_output_refuses_entire_plan(self):
        subprocess.run(['git', 'add', '-f', 'dist/sentinel'], cwd=self.repo, env=self.env, check=True)
        result = self.run_gate('--cleanup')
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue((self.repo / 'web/node_modules/sentinel').exists())
        self.assertTrue((self.repo / 'dist/sentinel').exists())

    def test_nested_symlink_and_readonly_module_do_not_touch_shared_cache(self):
        path = self.repo / '.cache/ci-local'
        (path / 'external').symlink_to(self.shared, target_is_directory=True)
        (path / 'module').mkdir(mode=0o500)
        storage.remove(storage.plan(self.repo))
        self.assertTrue((self.shared / 'keep').exists())
        self.assertFalse(path.exists())

    def test_running_gate_lock_refuses_cleanup(self):
        with (self.repo / '.git/open-habitat-gate.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            result = self.run_gate('--cleanup')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('already using', result.stderr)
        self.assertTrue((self.repo / 'web/node_modules/sentinel').exists())

    def test_successful_shell_cleans_before_recording_receipt(self):
        # Exercise the real shell orchestration with tiny stand-ins for expensive
        # phases. A prior synthetic receipt selects phase reuse; no suite runs.
        shutil.copy(SOURCE / 'gate-receipt.py', self.repo / 'scripts')
        bins = self.root / 'bin'
        bins.mkdir()

        def executable(path, text):
            path.write_text('#!/usr/bin/env bash\nset -eu\n' + text)
            path.chmod(0o755)

        for name in ('go', 'node', 'sha256sum'):
            executable(bins / name, 'exit 0\n')
        executable(bins / 'npm', '''mkdir -p web/dist/assets; echo fixture >web/dist/index.html
if [[ -n ${INJECT_BAD_OUTPUT:-} && ! -L web/node_modules ]];then
  ln -s "$INJECT_BAD_OUTPUT" web/node_modules
fi
''')
        executable(bins / 'tar', '''while [[ $1 != -C ]];do shift;done
shift
mkdir -p "$1/issuectl-aarch64-unknown-linux-musl" "$1/issuectl-x86_64-unknown-linux-musl"
for triple in aarch64 x86_64;do
  printf '#!/bin/sh\\necho "issuectl 0.21.0"\\n' >"$1/issuectl-$triple-unknown-linux-musl/issuectl"
  chmod +x "$1/issuectl-$triple-unknown-linux-musl/issuectl"
done
''')
        (self.repo / 'scripts/ci-python.sh').write_text('''oh_ci_venv(){
mkdir -p "$1/bin"
ln -s "$(command -v python3)" "$1/bin/python3"
ln -s "$(command -v python3)" "$1/bin/python"
}
''')
        executable(self.repo / 'scripts/native-fixture.sh', '''mkdir -p "$3/home/.pi/agent/sessions"
seq 2500 >"$3/home/.pi/agent/sessions/fixture.jsonl"
''')
        executable(self.repo / 'scripts/package-release.sh', '''mkdir -p "$8"
echo archive >"$8/open-habitat-$2-$4.tar.gz"
''')
        executable(self.repo / 'scripts/verify-release.sh', '! grep -q tampered "$2"\n')
        for name in ('test-package-socket.sh', 'test-package-fixture-guard.sh'):
            executable(self.repo / 'scripts' / name, 'exit 0\n')
        subprocess.run(['git', 'add', '.'], cwd=self.repo, env=self.env, check=True)
        subprocess.run(['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                        'commit', '-qm', 'fixture'], cwd=self.repo, env=self.env, check=True)
        subprocess.run(['python3', 'scripts/gate-receipt.py', 'record'], cwd=self.repo,
                       env=self.env, check=True, capture_output=True)
        result = self.run_gate('--clean', '--json', PATH=f'{bins}:{self.env["PATH"]}',
                               OH_SCRATCH_ROOT=str(self.root))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout.splitlines()[-1])['data']['status'], 'passed')
        for name in storage.OUTPUTS + storage.CACHES + storage.BROWSER_EVIDENCE:
            self.assertFalse((self.repo / name).exists(), name)
        receipt = subprocess.run(['python3', 'scripts/gate-receipt.py', 'check'], cwd=self.repo,
                                 env=self.env, capture_output=True, text=True)
        self.assertEqual(receipt.returncode, 0, receipt.stderr)
        receipt_path = Path(receipt.stdout.strip())
        before = receipt_path.read_bytes()
        self.assertEqual(json.loads(before)['reused_phases'], ['browser', 'go-and-contracts'])
        # A phase replacing an output with a shared-cache link must fail cleanup
        # without deleting the cache or refreshing the earlier passing receipt.
        result = self.run_gate('--clean', '--json', PATH=f'{bins}:{self.env["PATH"]}',
                               OH_SCRATCH_ROOT=str(self.root), INJECT_BAD_OUTPUT=str(self.shared))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('symlink', result.stderr)
        self.assertNotIn('"status":"passed"', result.stdout)
        self.assertEqual(receipt_path.read_bytes(), before)
        self.assertTrue((self.shared / 'keep').exists())

    def test_termination_keeps_logs_and_reclaims_own_scratch(self):
        bins = self.root / 'bin'
        bins.mkdir()
        marker = self.root / 'ready'
        curl = bins / 'curl'
        curl.write_text('#!/bin/sh\nprintf "%s" "$TMPDIR" >"$READY"\nsleep 30\n')
        curl.chmod(0o755)
        proc = subprocess.Popen(['bash', 'scripts/ci-local.sh'], cwd=self.repo,
                                env={**self.env, 'PATH': f'{bins}:{self.env["PATH"]}',
                                     'READY': str(marker)}, start_new_session=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            deadline = time.monotonic() + 10
            while not marker.exists() and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(marker.exists())
            run_tmp = Path(marker.read_text())
            os.killpg(proc.pid, signal.SIGTERM)
            stdout, stderr = proc.communicate(timeout=10)
            self.assertEqual(proc.returncode, 143, stdout + stderr)
            self.assertFalse(run_tmp.exists())
            self.assertFalse((self.repo / 'web/node_modules').exists())
            self.assertTrue((self.repo / '.git/open-habitat-gate-failure/status').exists())
        finally:
            if proc.poll() is None:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.communicate()

    def test_failed_gate_keeps_logs_receipts_and_failure_evidence(self):
        # Reach the real EXIT trap without downloading tools or running a suite.
        bins = self.root / 'bin'
        bins.mkdir()
        curl = bins / 'curl'
        curl.write_text('#!/bin/sh\necho synthetic-download-failure >&2\nexit 42\n')
        curl.chmod(0o755)
        subprocess.run(['git', 'add', '.'], cwd=self.repo, env=self.env, check=True)
        subprocess.run(['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                        'commit', '-qm', 'fixture'], cwd=self.repo, env=self.env, check=True)
        result = self.run_gate('--clean', '--no-reuse', PATH=f'{bins}:{self.env["PATH"]}',
                               OH_SCRATCH_ROOT=str(self.root))
        self.assertEqual(result.returncode, 42, result.stderr)
        logs = self.repo / '.git/open-habitat-gate-failure'
        self.assertIn('synthetic-download-failure', (logs / 'gate.stderr.log').read_text())
        self.assertFalse((logs / 'old.log').exists())
        self.assertTrue((self.repo / '.git/open-habitat-gate-receipts/tree.json').exists())
        self.assertTrue((self.repo / 'web/test-results/sentinel').exists())
        for name in storage.OUTPUTS + storage.CACHES:
            self.assertFalse((self.repo / name).exists(), name)
        self.assertEqual(list(self.root.glob('ohc.*')), [])


if __name__ == '__main__':
    unittest.main()
