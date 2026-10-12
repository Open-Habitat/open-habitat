#!/usr/bin/env python3
"""Local evidence that the full clean gate passed for a committed product tree."""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parent.parent


def git(*args):
    return subprocess.check_output(['git', '-C', str(REPO), *args], text=True).strip()


def identity():
    if git('status', '--porcelain'):
        raise ValueError('checkout is not clean')
    return git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}')


def receipt_path(tree):
    # Linked worktrees share a git common directory, but not ignored .cache trees.
    # A worker gate must remain visible to main when the merged tree is identical.
    common = Path(git('rev-parse', '--path-format=absolute', '--git-common-dir'))
    return common / 'open-habitat-gate-receipts' / (tree + '.json')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['record', 'check'])
    args = parser.parse_args()
    try:
        commit, tree = identity()
        path = receipt_path(tree)
        if args.action == 'record':
            path.parent.mkdir(parents=True, exist_ok=True)
            payload = {'schema_version': 1, 'status': 'passed', 'gate': 'scripts/ci-local.sh --clean --json',
                       'tree': tree, 'gate_inputs': {'committed_tree': tree}, 'source_commit': commit,
                       'completed_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
            fd, tmp = tempfile.mkstemp(dir=path.parent, prefix='.receipt-')
            try:
                with os.fdopen(fd, 'w') as f:
                    json.dump(payload, f, sort_keys=True)
                    f.write('\n')
                    f.flush()
                    os.fsync(f.fileno())
                os.replace(tmp, path)
            finally:
                if os.path.exists(tmp):
                    os.unlink(tmp)
            print(path)
        else:
            receipt = json.loads(path.read_text())
            if (receipt.get('schema_version') != 1 or receipt.get('status') != 'passed' or
                receipt.get('gate') != 'scripts/ci-local.sh --clean --json' or
                receipt.get('tree') != tree or
                receipt.get('gate_inputs') != {'committed_tree': tree}):
                raise ValueError('receipt does not cover the current committed tree and gate inputs')
            # A different commit with identical tree is safe: the gate covers content,
            # while the release separately pins and embeds the selected source commit.
            print(path)
    except (ValueError, OSError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print(f'error: clean gate receipt unavailable or invalid: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
