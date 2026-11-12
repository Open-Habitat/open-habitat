#!/usr/bin/env python3
"""Run focused browser evidence with ordinary commands; never writes a gate receipt."""
import argparse
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time


def scratch_dir():
    """Return a private run directory under the scratch root that scripts/scratch.sh describes.

    The returned lease file object must stay open while the directory is in use.
    """
    root = os.environ.get('OH_SCRATCH_ROOT', '')
    if root:
        if not (os.path.isabs(root) and os.path.isdir(root) and os.access(root, os.W_OK)):
            sys.exit(f'error: OH_SCRATCH_ROOT {root!r} is not a writable absolute directory')
    elif os.path.isdir('/var/tmp/agent-scratch') and os.access('/var/tmp/agent-scratch', os.W_OK):
        root = '/var/tmp/agent-scratch'
    else:
        root = '/var/tmp'
    lease = None
    try:
        import fcntl
        lease = open(os.path.join(root, '.lease'), 'rb')
        for _ in range(60):
            try:
                fcntl.flock(lease, fcntl.LOCK_SH | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                time.sleep(1)
        else:
            print(f'warning: scratch lease {lease.name} busy; continuing without it', file=sys.stderr)
    except OSError:
        pass
    return tempfile.mkdtemp(prefix='ohb.', dir=root), lease


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
    # Browser hosts, daemons and Chromium profiles go into this run's own
    # disk-backed TMPDIR, so whatever a killed child leaves goes with the run.
    run_tmp, lease = scratch_dir()
    os.environ['TMPDIR'] = run_tmp
    for sig in (signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, lambda signum, _frame: sys.exit(128 + signum))
    try:
        return run(args, repo)
    finally:
        shutil.rmtree(run_tmp, ignore_errors=True)
        if lease:
            lease.close()


def run(args, repo):
    # `git bisect run` and hooks export GIT_DIR; the host fixtures' `git init`
    # inheriting it would rewrite this repository instead of a scratch one.
    for name in subprocess.run(['git', 'rev-parse', '--local-env-vars'], capture_output=True,
                               text=True, check=True).stdout.split():
        os.environ.pop(name, None)
    os.umask(0o077)
    # Exercise request/event overtaking while developing; whole suites keep
    # their own policy, and an explicit zero disables focused-run jitter.
    if args.spec or args.tag:
        os.environ.setdefault('OH_REPLY_DELAY_MS', '60')
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
