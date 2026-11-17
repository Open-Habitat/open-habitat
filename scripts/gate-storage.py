#!/usr/bin/env python3
"""Remove only the gate's named, ignored checkout outputs; never shared caches."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

REPO = Path(__file__).resolve().parent.parent
OUTPUTS = (
    'web/node_modules', 'internal/daemon/pi-device-test/node_modules',
    'web/dist', 'web/storybook-static', 'dist', '.cache/browser-host',
)
CACHES = ('.cache/ci-local', '.cache/ms-playwright')
BROWSER_EVIDENCE = ('web/test-results', 'web/test-results-lab', 'web/playwright-report')


def plan(repo, *, keep_caches=False, success=False):
    names = OUTPUTS + (() if keep_caches else CACHES) + (BROWSER_EVIDENCE if success else ())
    # Validate the whole plan before deleting anything. Never follow a checkout
    # symlink into somebody's shared cache, or remove newly tracked source.
    tracked = subprocess.check_output(['git', '-C', str(repo), 'ls-files', '-z']).decode().split('\0')
    paths = []
    for name in names:
        path = repo / name
        for parent in (path, *path.parents):
            if parent == repo:
                break
            if parent.is_symlink():
                raise ValueError(f'refusing symlink cleanup path: {parent}')
        if any(p == name or p.startswith(name + '/') for p in tracked):
            raise ValueError(f'refusing tracked cleanup path: {name}')
        if subprocess.run(['git', '-C', str(repo), 'check-ignore', '-q', '--', name + '/']).returncode != 0:
            raise ValueError(f'refusing non-ignored cleanup path: {name}')
        if path.exists():
            paths.append(path)
    return paths


def remove(paths):
    for path in paths:
        if path.is_dir():
            # Old Go module caches can contain read-only directories. chmod only
            # directories, without following links embedded in installed packages.
            for root, _, _ in os.walk(path, followlinks=False):
                os.chmod(root, os.stat(root).st_mode | 0o700)
            shutil.rmtree(path)
        else:
            path.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--keep-caches', action='store_true')
    parser.add_argument('--success', action='store_true', help='also remove browser failure evidence')
    args = parser.parse_args()
    try:
        paths = plan(REPO, keep_caches=args.keep_caches, success=args.success)
        if not args.dry_run:
            remove(paths)
        data = {'dry_run': args.dry_run, 'paths': [str(p.relative_to(REPO)) for p in paths]}
        if args.json:
            print(json.dumps({'schema_version': 1, 'data': data, 'warnings': []}))
        else:
            print(('Would remove: ' if args.dry_run else 'Removed: ') + ', '.join(data['paths']))
        return 0
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        code = 1 if isinstance(exc, ValueError) else 2
        if args.json:
            print(json.dumps({'schema_version': 1, 'error': {'code': 'cleanup_refused' if code == 1 else 'io_error', 'message': str(exc)}}), file=sys.stderr)
        else:
            print(f'error: {exc}', file=sys.stderr)
        return code


if __name__ == '__main__':
    sys.exit(main())
