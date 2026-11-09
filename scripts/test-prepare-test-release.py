#!/usr/bin/env python3
"""Offline preparer gate-mode regression with synthetic git origin and build tools."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

HERE = Path(__file__).resolve().parent

# `git bisect run` and hooks export GIT_DIR; a scratch `git init` inheriting it
# rewrites the caller's repository (bare, from a linked worktree) instead.
for _name in subprocess.run(['git', 'rev-parse', '--local-env-vars'],
                            capture_output=True, text=True, check=True).stdout.split():
    os.environ.pop(_name, None)


class PrepareTests(unittest.TestCase):
    def test_ungated_succeeds_without_receipt_and_gated_refuses(self):
        with tempfile.TemporaryDirectory(dir='/var/tmp') as temp:
            root = Path(temp)
            repo, origin = root / 'checkout', root / 'origin.git'
            repo.mkdir()
            subprocess.run(['git', 'init', '-q', '--bare', str(origin)], check=True)
            def git(*args):
                return subprocess.run(['git', '-C', str(repo), *args], check=True,
                                      capture_output=True, text=True).stdout.strip()
            git('init', '-q')
            git('config', 'user.email', 'test@example.invalid')
            git('config', 'user.name', 'Test')
            git('remote', 'add', 'origin', str(origin))
            scripts = repo / 'scripts'
            scripts.mkdir()
            shutil.copy2(HERE / 'prepare-test-release.sh', scripts)
            shutil.copy2(HERE / 'gate-receipt.py', scripts)
            (repo / 'web').mkdir()
            (repo / 'web/package.json').write_text('{}')
            (scripts / 'verify-release.sh').write_text('#!/bin/sh\nexit 0\n')
            (scripts / 'package-release.sh').write_text('''#!/bin/sh
set -eu
for arg do case "$arg" in /var/*) out=$arg;; esac; done
name=open-habitat-0.0.0-pilot.99-linux-amd64
mkdir -p "$out/$name/bin"
cat > "$out/$name/bin/open-habitat" <<EOF
#!/bin/sh
echo '{"data":{"commit":"$(git rev-parse HEAD)","version":"0.0.0-pilot.99"}}'
EOF
chmod +x "$out/$name/bin/open-habitat"
tar -czf "$out/$name.tar.gz" -C "$out" "$name"
echo "$out/$name.tar.gz"
''')
            for path in (scripts / 'verify-release.sh', scripts / 'package-release.sh'):
                path.chmod(0o755)
            git('add', '.')
            git('commit', '-qm', 'synthetic source')
            git('push', '-q', 'origin', 'HEAD:main')
            fake = root / 'fake-bin'
            fake.mkdir()
            (fake / 'npm').write_text('#!/bin/sh\nexit 0\n')
            (fake / 'npm').chmod(0o755)
            output = root / 'output'
            output.mkdir()
            env = {**os.environ, 'PATH': str(fake) + ':' + os.environ['PATH']}
            cmd = [str(scripts / 'prepare-test-release.sh'), '--version',
                   '0.0.0-pilot.99', '--output', str(output)]
            gated = subprocess.run(cmd, cwd=repo, env=env, capture_output=True, text=True)
            self.assertNotEqual(gated.returncode, 0)
            self.assertIn('receipt unavailable', gated.stderr)
            ungated = subprocess.run([cmd[0], '--ungated', *cmd[1:]], cwd=repo,
                                    env=env, capture_output=True, text=True)
            self.assertEqual(ungated.returncode, 0, ungated.stderr)
            self.assertEqual(json.loads((output / 'release-gate.json').read_text()), {
                'gate': 'ungated', 'source_commit': git('rev-parse', 'HEAD'),
                'tree': git('rev-parse', 'HEAD^{tree}')})


if __name__ == '__main__':
    unittest.main()
