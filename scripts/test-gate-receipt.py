#!/usr/bin/env python3
"""Offline tree-keyed gate receipt regression tests."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('gate-receipt.py')


class ReceiptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir='/var/tmp')
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        (self.repo / 'scripts').mkdir()
        shutil.copy2(SCRIPT, self.repo / 'scripts' / SCRIPT.name)
        self.git('init', '-q')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('config', 'user.name', 'Test')
        (self.repo / '.gitignore').write_text('.cache/\n')
        (self.repo / 'input').write_text('first')
        self.git('add', 'input', '.gitignore', 'scripts/gate-receipt.py')
        self.git('commit', '-qm', 'first')

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], text=True).strip()

    def run_receipt(self, action, *extra):
        return subprocess.run(['python3', str(self.repo / 'scripts' / SCRIPT.name), action, *extra],
                              capture_output=True, text=True)

    def test_same_tree_and_different_tree(self):
        self.assertEqual(self.run_receipt('record').returncode, 0)
        self.assertEqual(self.run_receipt('check').returncode, 0)
        tree = self.git('rev-parse', 'HEAD^{tree}')
        receipt = self.repo / '.git/open-habitat-gate-receipts' / (tree + '.json')
        self.assertEqual(json.loads(receipt.read_text())['gate_inputs'], {'committed_tree': tree})
        (self.repo / 'input').write_text('second')
        self.git('add', 'input')
        self.git('commit', '-qm', 'second')
        self.assertNotEqual(self.run_receipt('check').returncode, 0)
        self.git('checkout', '-q', 'HEAD^')
        self.assertEqual(self.run_receipt('check').returncode, 0)

    def test_reused_phase_still_requires_current_tree(self):
        self.assertNotEqual(self.run_receipt('record', '--reused-phase', 'browser').returncode, 0)
        self.assertEqual(self.run_receipt('record').returncode, 0)
        self.assertEqual(self.run_receipt('record', '--reused-phase', 'browser', '--reused-phase', 'go-and-contracts').returncode, 0)
        tree = self.git('rev-parse', 'HEAD^{tree}')
        receipt = self.repo / '.git/open-habitat-gate-receipts' / (tree + '.json')
        reused = json.loads(receipt.read_text())
        self.assertEqual(reused['reused_phases'], ['browser', 'go-and-contracts'])
        self.assertEqual(self.run_receipt('record', '--reused-phase', 'browser').returncode, 0)
        self.assertEqual(json.loads(receipt.read_text())['phase_evidence_completed_at'],
                         reused['phase_evidence_completed_at'])
        self.assertEqual(self.run_receipt('check').returncode, 0)
        (self.repo / 'input').write_text('changed')
        self.git('add', 'input')
        self.git('commit', '-qm', 'change')
        self.assertNotEqual(self.run_receipt('check').returncode, 0)

    def test_linked_worktree_reuses_same_tree(self):
        self.assertEqual(self.run_receipt('record').returncode, 0)
        linked = self.repo.parent / ('linked-' + self.repo.name)
        self.git('worktree', 'add', '--detach', '-q', str(linked), 'HEAD')
        self.addCleanup(lambda: self.git('worktree', 'remove', '--force', str(linked)))
        result = subprocess.run(['python3', str(linked / 'scripts/gate-receipt.py'), 'check'],
                                capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_dirty_and_corrupt(self):
        self.assertEqual(self.run_receipt('record').returncode, 0)
        (self.repo / 'untracked').write_text('dirty')
        self.assertNotEqual(self.run_receipt('check').returncode, 0)
        (self.repo / 'untracked').unlink()
        tree = self.git('rev-parse', 'HEAD^{tree}')
        receipt = self.repo / '.git/open-habitat-gate-receipts' / (tree + '.json')
        receipt.write_text('{"status":"passed"}')
        self.assertNotEqual(self.run_receipt('check').returncode, 0)


if __name__ == '__main__':
    unittest.main()
