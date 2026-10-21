#!/usr/bin/env python3
"""Heavy check placement and thin Fleetrepo client; no source transport or queue."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import signal
import stat
import subprocess
import sys
import tempfile
import time
import uuid

TERMINAL = {'success', 'test-exit', 'timeout', 'oom', 'cancelled', 'interrupted', 'quota'}
ID = re.compile(r'[0-9a-f]{64}')


def guest_facts_valid(facts, spec=None):
    """Root-owned task plus kernel identity, never an environment-only bypass."""
    task = facts['task']
    legacy_spec = task.get('spec') if isinstance(task, dict) and spec is None else spec
    legacy = task == {'task': 'oh-browser', 'spec': legacy_spec,
                      'profile': 'oh-linux-arm64-v1', 'workers': 2}
    declared = False
    if isinstance(task, dict) and task.get('task') in task_catalog():
        body = task_catalog()[task['task']]
        declared = (task == dict(body, task=task['task'], args=task.get('args'))
                    and isinstance(task.get('args'), list)
                    and len(task['args']) <= 32
                    and (body['allow_args'] or not task['args']))
    return (facts['system'] == 'Linux' and facts['machine'] == 'aarch64'
            and facts['user'] == 'hbjob' and facts['repo'] == '/j/src'
            and facts['trusted_files'] and facts['installed_marker']
            and (legacy or declared)
            and re.search(r'(?:^|/)hb-exec-job-[0-9a-f]{64}\.service(?:/|$)', facts['cgroup']) is not None)


def task_catalog():
    return json.loads((Path(__file__).resolve().parent.parent / '.hb-exec.json').read_text())['tasks']


def trusted_marker(path):
    # installed.json is root-readable only in runner 0.1.0; ownership/mode are the admission fact.
    for part in [path, *path.parents]:
        info = part.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError(f'untrusted guest installation marker: {part}')
    return stat.S_ISREG(path.lstat().st_mode)


def trusted_json(path, job_metadata=False):
    # The runner binds /j as hbjob-writable, but task.json itself is root:root 0444.
    # A replacement cannot acquire root ownership. Inspect the opened inode, not a racy stat/read pair.
    for part in path.parents:
        info = part.lstat()
        if stat.S_ISLNK(info.st_mode) or (not (job_metadata and part == Path('/j'))
                                       and (info.st_uid != 0 or info.st_mode & 0o022)):
            raise ValueError(f'untrusted guest context: {part}')
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW)) as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError(f'untrusted guest context: {path}')
        return json.load(stream)


def placement(repo, spec):
    uname = os.uname()
    # Kernel facts, not PATH's hostname or an environment-selectable local mode.
    if uname.nodename.split('.')[0].lower() == 'alder':
        return 'remote'
    if os.environ.get('HB_EXEC_CONTEXT'):
        if os.environ['HB_EXEC_CONTEXT'] != 'guest-v1':
            raise ValueError('unsupported guest context')
        facts = dict(system=uname.sysname, machine=uname.machine, user=pwd.getpwuid(os.getuid()).pw_name,
                     repo=str(repo), trusted_files=True,
                     installed_marker=trusted_marker(Path('/opt/hb-exec/installed.json')),
                     task=trusted_json(Path('/j/task.json'), job_metadata=True),
                     cgroup=Path('/proc/self/cgroup').read_text())
        if not guest_facts_valid(facts, spec):
            raise ValueError('guest platform/task/process context verification failed')
        return 'guest'
    if uname.sysname != 'Linux':
        raise ValueError('browser host requires Linux; no supported local browser executor here')
    return 'local'


class Cancelled(Exception):
    def __init__(self, signum):
        self.signum = signum


class Runner:
    def __init__(self, directory):
        self.directory = directory
        self.sequence = 0

    def call(self, *args):
        self.sequence += 1
        output = self.directory / f'{self.sequence:03d}-{args[0]}.json'
        error = output.with_suffix('.stderr')
        with output.open('wb') as out, error.open('wb') as err:
            child = subprocess.Popen(['fleetrepo-exec', *args, '--json'], stdout=out, stderr=err)
            try:
                code = child.wait()
            except BaseException:
                child.terminate()
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait()
                raise
        if code:
            raise ValueError(f'fleetrepo-exec {args[0]} failed ({code}); {error}: '
                             + error.read_bytes()[:2048].decode(errors='replace'))
        envelope = json.loads(output.read_bytes())
        if envelope.get('schema_version') != 1 or not isinstance(envelope.get('data'), dict):
            raise ValueError(f'invalid runner envelope: {output}')
        return envelope['data']


def print_summary(data):
    # Do not dump the source manifest (thousands of files) into an agent's context.
    fields = ('id', 'state', 'snapshot_sha256', 'input_identity', 'attempt', 'reason', 'queue_reason', 'stale', 'source_stale',
              'platform', 'profile', 'result', 'output', 'truncated')
    summary = {key: data[key] for key in fields if key in data}
    if len(json.dumps(summary)) > 8192:
        summary = {'id': str(data.get('id', ''))[:64], 'state': str(data.get('state', ''))[:64],
                   'metadata_truncated': True}
    print(json.dumps(summary), flush=True)


def remote(repo, args):
    if args.job and (args.untracked or args.writers_paused or args.idempotency_key):
        raise ValueError('--job observes an existing job; do not combine with capture options')
    if not args.job and args.spec:
        selected = f'web/tests/{args.spec}'
        tracked = subprocess.run(['git', 'ls-files', '--error-unmatch', '--', selected], cwd=repo,
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
        if not tracked and selected not in args.untracked:
            raise ValueError(f'new spec is not tracked: explicitly select --untracked {selected}')
    directory = Path(tempfile.mkdtemp(prefix='oh-browser-', dir='/var/tmp'))
    print(f'Runner responses: {directory}', flush=True)
    runner = Runner(directory)
    key = args.idempotency_key or f'oh-browser-{uuid.uuid4()}'
    job = args.job or hashlib.sha256(key.encode()).hexdigest()
    print(f'Job: {job}; observe without resubmission: --task {args.task} --job {job}', flush=True)
    if not args.job:
        print(f'Capture idempotency key: {key}; foreground caller pauses cooperating writers until capture returns; explicit untracked selections: {len(args.untracked)} (default none).', flush=True)
    # INT/TERM explicitly cancel; HUP/crash merely loses the observer. Identity is printed before capture.
    def cancel(signum, _frame):
        raise Cancelled(signum)
    old = {sig: signal.signal(sig, cancel) for sig in (signal.SIGINT, signal.SIGTERM)}
    try:
        if not args.job:
            argv = ['create', '--source', str(repo), '--task', args.task,
                    '--idempotency-key', key, '--writers-paused']
            for value in args.task_arg:
                argv.append('--task-arg=' + value)
            for path in args.untracked:
                argv.extend(['--untracked', path])
            # Capture is synchronous. Defer cancellation until its acknowledgement so cancel cannot race create.
            pending = []
            for sig in old:
                signal.signal(sig, lambda sig, frame: pending.append(sig))
            try:
                data = runner.call(*argv)
            finally:
                for sig in old:
                    signal.signal(sig, cancel)
            if data.get('id') != job:
                raise ValueError('runner create returned unexpected job identity')
            print('Capture returned; cooperating writers may resume.', flush=True)
            if pending:
                raise Cancelled(pending[0])
        deadline = time.monotonic() + args.wait_timeout
        while True:
            data = runner.call('show', job, '--stale')
            print_summary(data)
            state = data.get('state')
            if state in TERMINAL:
                break
            if state not in {'queued', 'running', 'dispatching', 'cancelling'}:
                raise ValueError(f'unresolved runner state {state!r}; retain job {job}; no resubmit')
            remaining = deadline - time.monotonic()
            if remaining < 1:
                raise ValueError(f'observer wait deadline; job {job} is not complete or cancelled; reconnect with --job')
            waited = runner.call('wait', job, '--timeout', str(min(120, max(1, int(remaining)))))
            print_summary(waited)
            if waited.get('state') not in TERMINAL | {'queued', 'running', 'dispatching', 'cancelling'}:
                raise ValueError(f'unresolved runner wait state {waited.get("state")!r}; retain job {job}; no resubmit')
        logs = runner.call('logs', job)
        rendered = json.dumps(logs, ensure_ascii=False)
        print('Bounded runner log tail (full capped response retained): ' + rendered[:16384]
              + (' [display truncated]' if len(rendered) > 16384 else ''), flush=True)
        fetched = runner.call('fetch', job, '--output', str(directory / f'job-{job}'))
        print_summary(fetched)
        print(f'Terminal {state}; evidence {directory}; no source writeback or clean-gate receipt.', flush=True)
        return 0 if state == 'success' else 1
    except Cancelled as interrupted:
        # A second signal must not interrupt durable cancellation acknowledgement.
        for sig in old:
            signal.signal(sig, signal.SIG_IGN)
        print_summary(runner.call('cancel', job))
        print(f'Cancel requested for {job}; use fleetrepo-exec show to confirm terminal state.', flush=True)
        return 128 + interrupted.signum
    finally:
        for sig, handler in old.items():
            signal.signal(sig, handler)


def web_commands():
    return json.loads((Path(__file__).resolve().parent / 'web-commands.json').read_text())


def main(argv=None):
    parser = argparse.ArgumentParser(description='Heavy checks: Alder remote-only, verified runner guest, or native Linux. No local fallback.')
    parser.add_argument('--placement', action='store_true', help='probe placement before local prerequisites')
    parser.add_argument('--task', choices=sorted(task_catalog()))
    parser.add_argument('--task-arg', action='append', default=[])
    parser.add_argument('--web-script', choices=sorted(k for k in web_commands() if 'oh-web-' + k.replace(':', '-') in task_catalog()))
    parser.add_argument('--lab', action='store_true')
    parser.add_argument('--spec')
    parser.add_argument('--tag')
    parser.add_argument('--writers-paused', action='store_true')
    parser.add_argument('--untracked', action='append', default=[], help='explicit relative input selection; repeatable; default none')
    parser.add_argument('--idempotency-key')
    parser.add_argument('--job', help='observe existing 64-hex job without resubmission')
    parser.add_argument('--wait-timeout', type=int, default=7500, help='observer seconds, 1..86400; expiry is not cancellation')
    args, tail = parser.parse_known_args(argv)
    if tail and not ((args.web_script or args.task) and tail[0] == '--'):
        parser.error('unknown arguments: ' + ' '.join(tail))
    if tail:
        args.task_arg.extend(tail[1:])
    repo = Path(__file__).resolve().parent.parent
    if args.spec is not None and (not re.fullmatch(r'[a-zA-Z0-9-]+\.spec\.ts', args.spec)
                                  or (not args.job and not (repo / 'web/tests' / args.spec).is_file())):
        raise ValueError('invalid or missing spec: use an existing web/tests/NAME.spec.ts basename; explicitly --untracked a new selected spec')
    if args.tag is not None and (not args.tag or args.tag.startswith('-')):
        raise ValueError('invalid tag')
    if not 1 <= args.wait_timeout <= 86400 or (args.job and not ID.fullmatch(args.job)):
        raise ValueError('invalid wait-timeout or job ID')
    if args.idempotency_key is not None and not re.fullmatch(r'[A-Za-z0-9_.:-]{1,128}', args.idempotency_key):
        raise ValueError('idempotency key must be 1..128 ASCII letters/digits/_.:-')
    where = placement(repo, args.spec)
    if args.placement:
        print(where)
        return 0
    if args.web_script:
        if args.task or args.spec or args.tag or args.lab:
            raise ValueError('--web-script cannot be combined with browser/task selection')
        args.task = 'oh-web-' + args.web_script.replace(':', '-')
    if not args.task:
        args.task = 'oh-browser-lab' if args.lab or (args.spec and args.spec.startswith('lab-')) else 'oh-browser-ordinary'
        if args.spec:
            if args.spec == 'synthetic-demo.spec.ts':
                raise ValueError('synthetic demo has a separate local specialist config')
            args.task_arg.append('tests/' + args.spec)
        if args.tag:
            args.task_arg.extend(['--grep', args.tag])
    elif args.spec or args.tag or args.lab:
        raise ValueError('explicit --task cannot be combined with browser selectors')
    definition = task_catalog()[args.task]
    if (len(args.task_arg) > 32 or (args.task_arg and not definition['allow_args'])
            or any(not x or len(x) > 4096 or any(ord(c) < 32 for c in x) for x in args.task_arg)):
        raise ValueError('invalid literal task arguments')
    if where == 'remote' or args.job or args.writers_paused or args.untracked or args.idempotency_key:
        if where == 'guest':
            raise ValueError('capture options cannot recursively submit from guest')
        return remote(repo, args)
    if args.web_script:
        command = web_commands()[args.web_script] + args.task_arg
        return subprocess.call(command, cwd=repo / 'web')
    if not args.task.startswith('oh-browser-'):
        command = definition['phases'][-1]
        return subprocess.call(command['argv'] + args.task_arg, cwd=repo / command['cwd'])
    print(f'Browser ({where}); no Go/contracts/packaging gate or clean receipt.', file=sys.stderr)
    if not (repo / 'web/node_modules/.bin/playwright').is_file():
        raise ValueError('local executor needs npm ci --prefix web first')
    command = ['npx', 'playwright', 'test']
    if args.task == 'oh-browser-lab':
        command += ['--config', 'playwright.lab.config.ts']
    command += args.task_arg
    if where == 'guest':
        command += ['--workers=' + os.environ.get('OH_BROWSER_WORKERS', '2')]
    return subprocess.call(command, cwd=repo / 'web')


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError) as error:
        print(f'error: {error}', file=sys.stderr)
        sys.exit(2)
