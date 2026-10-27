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
    parser.add_argument('--spec')
    parser.add_argument('--tag')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parent.parent
    if args.spec and (not re.fullmatch(r'[a-zA-Z0-9-]+\.spec\.ts', args.spec)
                      or not (repo / 'web/tests' / args.spec).is_file()):
        parser.error('spec must name an existing web/tests/NAME.spec.ts')
    if args.spec == 'synthetic-demo.spec.ts':
        parser.error('synthetic demo has a separate specialist config')
    if args.tag is not None and (not args.tag or args.tag.startswith('-')):
        parser.error('invalid tag')
    os.environ['TMPDIR'] = '/var/tmp'
    os.umask(0o077)
    command = ['npx', 'playwright', 'test']
    if args.lab or (args.spec and args.spec.startswith('lab-')):
        command += ['--config', 'playwright.lab.config.ts']
    if args.spec:
        command += ['tests/' + args.spec]
    if args.tag:
        command += ['--grep', args.tag]
    if not args.spec and not args.tag:
        # A whole suite waits for any other whole suite on this host.
        command = [sys.executable, str(repo / 'scripts/browser-suite-lock.py'),
                   '--label', str(repo), '--'] + command
    return subprocess.call(command, cwd=repo / 'web')


if __name__ == '__main__':
    sys.exit(main())
