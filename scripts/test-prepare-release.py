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
    def install(self, repo):
        shutil.copy2(HERE / 'prepare-release.sh', repo / 'scripts')

    def command(self, scripts, output, gate):
        return [str(scripts / 'prepare-release.sh'), '--gate', gate,
                '--remote', 'origin', '--branch', 'main', '--target', 'linux-amd64',
                '--version', '0.0.0-pilot.99', '--output', str(output)]

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
            self.install(repo)
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
            (scripts / 'prepare-release-closure.py').write_text('''import json, pathlib, sys
repo, cache, output, binary, target, version, commit = sys.argv[1:]
out = pathlib.Path(output)
out.mkdir()
(out / 'release.json').write_text(json.dumps({'version': version, 'commit': commit, 'target': target}))
print('synthetic runtime verification', file=sys.stderr)
''')
            git('add', '.')
            git('commit', '-qm', 'synthetic source')
            git('push', '-q', 'origin', 'HEAD:main')
            fake = root / 'fake-bin'
            fake.mkdir()
            (fake / 'npm').write_text('#!/bin/sh\nexit 0\n')
            (fake / 'npm').chmod(0o755)
            (fake / 'go').write_text('#!/bin/sh\nif [ "$1" = env ]; then echo arm64; fi\n')
            (fake / 'go').chmod(0o755)
            output = root / 'output'
            output.mkdir()
            env = {**os.environ, 'PATH': str(fake) + ':' + os.environ['PATH']}
            cmd = self.command(scripts, output, 'clean-gate')
            gated = subprocess.run(cmd, cwd=repo, env=env, capture_output=True, text=True)
            self.assertNotEqual(gated.returncode, 0)
            self.assertIn('receipt unavailable', gated.stderr)
            ungated = subprocess.run(self.command(scripts, output, 'ungated'), cwd=repo,
                                    env=env, capture_output=True, text=True)
            self.assertEqual(ungated.returncode, 0, ungated.stderr)
            self.assertEqual(json.loads((output / 'release-gate.json').read_text()), {
                'gate': 'ungated', 'source_commit': git('rev-parse', 'HEAD'),
                'tree': git('rev-parse', 'HEAD^{tree}')})
            runtime_output = root / 'with-runtime'
            runtime = subprocess.run(self.command(scripts, runtime_output, 'ungated') +
                                     ['--runtime-cache', str(root / 'runtime-cache')], cwd=repo,
                                     env=env, capture_output=True, text=True)
            self.assertEqual(runtime.returncode, 0, runtime.stderr)
            self.assertEqual(len(runtime.stdout.splitlines()), 1)
            self.assertIn('synthetic runtime verification', runtime.stderr)
            self.assertEqual(json.loads((runtime_output / 'runtime/release.json').read_text()), {
                'version': '0.0.0-pilot.99', 'commit': git('rev-parse', 'HEAD'), 'target': 'linux-amd64'})
            self.assertTrue((runtime_output / 'release-gate.json').exists())
            invalid = subprocess.run(self.command(scripts, root / 'invalid', 'ungated') +
                                     ['--runtime-cache', 'relative'], cwd=repo, env=env,
                                     capture_output=True, text=True)
            self.assertNotEqual(invalid.returncode, 0)
            self.assertIn('absolute disposable directory', invalid.stderr)
            # Both policy modes still require the exact committed, pushed source.
            (repo / 'untracked').write_text('dirty')
            dirty = subprocess.run(self.command(scripts, root / 'dirty-output', 'ungated'),
                                   cwd=root, env=env, capture_output=True, text=True)
            self.assertNotEqual(dirty.returncode, 0)
            self.assertIn('checkout is not clean', dirty.stderr)
            git('add', '.')
            git('commit', '-qm', 'not pushed')
            unpushed = subprocess.run(self.command(scripts, root / 'unpushed-output', 'ungated'),
                                      cwd=root, env=env, capture_output=True, text=True)
            self.assertNotEqual(unpushed.returncode, 0)
            self.assertIn('source is not pushed', unpushed.stderr)
            self.assertFalse((root / 'unpushed-output').exists())


if __name__ == '__main__':
    unittest.main()
