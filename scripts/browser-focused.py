#!/usr/bin/env python3
"""Run focused browser evidence with ordinary commands; never writes a gate receipt."""
import argparse
import os
from pathlib import Path
import re
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lab', action='store_true')
    parser.add_argument('--spec', action='append', default=[], help='spec filename (repeatable)')
    parser.add_argument('--tag')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parent.parent
    for spec in args.spec:
        if (not re.fullmatch(r'[a-zA-Z0-9-]+\.spec\.ts', spec)
                or not (repo / 'web/tests' / spec).is_file()):
            parser.error(f'{spec!r}: spec must name an existing web/tests/NAME.spec.ts')
        if spec == 'synthetic-demo.spec.ts':
            parser.error('synthetic demo has a separate specialist config')
    if args.tag is not None and (not args.tag or args.tag.startswith('-')):
        parser.error('invalid tag')
    os.environ['TMPDIR'] = '/var/tmp'
    # `git bisect run` and hooks export GIT_DIR; the host fixtures' `git init`
    # inheriting it would rewrite this repository instead of a scratch one.
    for name in subprocess.run(['git', 'rev-parse', '--local-env-vars'], capture_output=True,
                               text=True, check=True).stdout.split():
        os.environ.pop(name, None)
    os.umask(0o077)
    # DEFAULT-ON SWITCH: change 0 to 60 once the product ordering fixes land.
    if args.spec or args.tag:
        os.environ.setdefault('OH_REPLY_DELAY_MS', '0')
    # Different configs exclude each other's specs; never silently lose one
    # when a focused selection spans both suites.
    groups = {}
    for spec in args.spec:
        groups.setdefault(args.lab or spec.startswith('lab-'), []).append(spec)
    if not groups:
        groups[args.lab] = []
    result = 0
    for lab, specs in groups.items():
        command = ['npx', 'playwright', 'test']
        if lab:
            command += ['--config', 'playwright.lab.config.ts']
        command += ['tests/' + spec for spec in specs]
        if args.tag:
            command += ['--grep', args.tag]
        if not args.spec and not args.tag:
            # A whole suite waits for any other whole suite on this host.
            command = [sys.executable, str(repo / 'scripts/browser-suite-lock.py'),
                       '--label', str(repo), '--'] + command
        status = subprocess.call(command, cwd=repo / 'web')
        if status and not result:
            result = status if status > 0 else 1
    return result


if __name__ == '__main__':
    sys.exit(main())
