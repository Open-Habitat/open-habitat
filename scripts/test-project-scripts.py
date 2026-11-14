#!/usr/bin/env python3
"""Networkless regression tests for documentation, pruning and archive lookup."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1]
ENV = os.environ.copy()
for key in subprocess.check_output(['git', 'rev-parse', '--local-env-vars'], text=True).splitlines():
    ENV.pop(key, None)
ENV.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null',
           GIT_AUTHOR_NAME='Test', GIT_AUTHOR_EMAIL='test@example.invalid',
           GIT_COMMITTER_NAME='Test', GIT_COMMITTER_EMAIL='test@example.invalid')


class ProjectScripts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='project-scripts-', dir=os.environ.get('TMPDIR', '/var/tmp'))
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'product'
        self.root.mkdir()
        self.run_cmd('git', 'init', '-q')
        for name in ('validate-project-view.py', 'prune-closed.py', 'from-history.sh'):
            self.put('scripts/' + name, (SOURCE / 'scripts' / name).read_text())
        self.put('.gitignore', 'history/\n')
        self.put('docs/decisions/index.md', '# Decisions\n')
        self.put('docs/operations.md', '# Operations\n')
        for slug, state in [('old-result', 'done'), ('public-result', 'done'), ('current', 'open')]:
            self.put(f'issues/{slug}/item.md', f'---\nstatus: {state}\n---\n')
        self.put('issues/current/result.md', 'public-result\n')
        self.put('TODO.md', 'old-result\n')
        self.put('KOKEILTAVAA.md', 'old-result\n')
        self.run_cmd('git', 'add', '.')
        self.run_cmd('git', 'commit', '-qm', 'fixture')
        clone = Path(self.temp.name) / 'clone'
        self.run_cmd('git', 'clone', '-q', str(self.root), str(clone))
        self.root = clone

    def put(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def run_cmd(self, *argv, expected=0):
        result = subprocess.run(argv, cwd=self.root, env=ENV, text=True, capture_output=True)
        self.assertEqual(result.returncode, expected, result.stdout + result.stderr)
        return result.stdout

    def test_pruning_explicit_references_and_no_private_files(self):
        self.run_cmd('python3', 'scripts/validate-project-view.py')
        data = json.loads(self.run_cmd('python3', 'scripts/prune-closed.py', '--json'))
        self.assertEqual(data['removable'], ['old-result'])
        self.assertIn('public-result', data['kept'])
        data = json.loads(self.run_cmd('python3', 'scripts/prune-closed.py', '--json',
                                      '--reference-file', 'TODO.md', '--reference-file', 'KOKEILTAVAA.md'))
        self.assertEqual(data['removable'], [])
        self.assertEqual(data['kept']['old-result'], ['KOKEILTAVAA.md', 'TODO.md'])
        for name in ('TODO.md', 'KOKEILTAVAA.md'):
            (self.root / name).unlink()
        self.run_cmd('python3', 'scripts/validate-project-view.py')
        self.run_cmd('python3', 'scripts/prune-closed.py', '--reference-file', 'TODO.md', '--apply', expected=2)
        self.assertTrue((self.root / 'issues/old-result/item.md').exists())
        self.run_cmd('python3', 'scripts/prune-closed.py', '--json')

    def test_public_guards(self):
        self.run_cmd('python3', 'scripts/validate-project-view.py')
        self.put('docs/operations.md', '[missing](missing.md)\n')
        self.run_cmd('python3', 'scripts/validate-project-view.py', expected=1)
        self.put('docs/operations.md', '# Operations\n')
        self.put('docs/decisions/adr-0001-test.md', '# Decision\n')
        self.run_cmd('python3', 'scripts/validate-project-view.py', expected=1)
        self.put('docs/decisions/index.md', '[Decision](adr-0001-test.md)\n')
        self.run_cmd('python3', 'scripts/validate-project-view.py')
        self.put('AGENTS.md', 'issues/old-result\n')
        self.run_cmd('python3', 'scripts/validate-project-view.py', expected=1)
        (self.root / 'AGENTS.md').unlink()
        self.put('history/.worktree/brief.md', 'private\n')
        self.run_cmd('git', 'add', '-f', 'history')
        self.run_cmd('python3', 'scripts/validate-project-view.py', expected=1)
        self.run_cmd('git', 'rm', '--cached', '-rf', 'history')
        self.put('.gitignore', '')
        self.run_cmd('python3', 'scripts/validate-project-view.py', expected=1)

    def test_vendored_canon_excludes_generator_maintenance(self):
        for agent in ('.claude', '.pi'):
            with self.subTest(agent=agent):
                name = f'{agent}/skills/ai-first-cli-canon/SKILL.md'
                clean = '<!-- Installed by project-canon -->\n# CLI canon\n'
                self.put(name, clean)
                self.run_cmd('python3', 'scripts/validate-project-view.py')
                self.put(name, clean + '<!-- PROVENANCE / MAINTENANCE (project-canon).\n'
                         'Synthetic upstream authoring context. -->\n')
                self.run_cmd('python3', 'scripts/validate-project-view.py', expected=1)
                self.put(name, clean)
                self.run_cmd('python3', 'scripts/validate-project-view.py')

    def test_explicit_archive(self):
        self.put('removed.md', 'archive content\n')
        self.run_cmd('git', 'add', 'removed.md')
        self.run_cmd('git', 'commit', '-qm', 'add archive file')
        self.run_cmd('git', 'rm', 'removed.md')
        self.run_cmd('git', 'commit', '-qm', 'remove archive file')
        archive = self.root
        self.root = Path(self.temp.name) / 'fresh'
        self.root.mkdir()
        self.run_cmd('git', 'init', '-q')
        script = str(SOURCE / 'scripts/from-history.sh')
        self.run_cmd('bash', script, 'removed.md', expected=1)
        self.assertEqual(self.run_cmd('bash', script, '--archive', str(archive), 'removed.md'), 'archive content\n')


if __name__ == '__main__':
    unittest.main()
