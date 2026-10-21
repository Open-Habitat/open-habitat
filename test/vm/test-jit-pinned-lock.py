#!/usr/bin/env python3
"""Offline check of the immutable Fleetrepo guest gate's bounded lock behavior."""
import ast
import fcntl
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time

root = Path(__file__).resolve().parents[2]
fixture = ast.parse((root / 'test/vm/jit-fixture.py').read_text())
values = {n.targets[0].id: ast.literal_eval(n.value) for n in fixture.body
          if isinstance(n, ast.Assign) and len(n.targets) == 1
          and isinstance(n.targets[0], ast.Name) and n.targets[0].id in ('head', 'receipts')}
assert values['head'] == '3a165c4f3a455e76f29b04f97823b4ee5fcfa40d'
assert len(values['receipts']) == 9
source = os.environ.get('FLEETREPO_JIT_SOURCE', '/home/maintainer/Sources/fleetrepo')
blobs = {}
for name, digest in values['receipts'].items():
    blob = subprocess.check_output(['git', '-C', source, 'show',
                                    f"{values['head']}:infra/native-agent-host-test/{name}"])
    assert hashlib.sha256(blob).hexdigest() == digest, name
    blobs[name] = blob
policy = ast.parse(blobs['jit_policy.py'])
fn = next(n for n in policy.body if isinstance(n, ast.FunctionDef) and n.name == 'shared_state_lock')
class Refusal(Exception):
    pass
space = {'fcntl': fcntl, 'time': time, 'Refusal': Refusal}
exec(compile(ast.Module(body=[fn], type_ignores=[]), '<pinned-gate>', 'exec'), space)
lock = space['shared_state_lock']
with tempfile.TemporaryDirectory() as directory:
    owner = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
    waiter = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
    try:
        fcntl.flock(owner, fcntl.LOCK_EX)
        released = threading.Event()
        def unlock():
            time.sleep(0.12)
            fcntl.flock(owner, fcntl.LOCK_UN)
            released.set()
        thread = threading.Thread(target=unlock)
        thread.start()
        start = time.monotonic()
        lock(waiter, timeout=1)
        assert released.is_set() and time.monotonic() - start >= 0.1, 'gate refused immediate contention'
        fcntl.flock(waiter, fcntl.LOCK_UN)
        thread.join()
        fcntl.flock(owner, fcntl.LOCK_EX)
        start = time.monotonic()
        try:
            lock(waiter, timeout=0.12)
        except Refusal as error:
            assert str(error) == 'state directory lock busy'
        else:
            raise AssertionError('busy gate bypassed exclusive lock')
        assert 0.1 <= time.monotonic() - start < 0.8
    finally:
        os.close(waiter)
        os.close(owner)
print('nine immutable Fleetrepo digests and bounded shared-lock retry/refusal verified offline')
