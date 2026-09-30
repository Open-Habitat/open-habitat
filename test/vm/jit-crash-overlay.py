#!/usr/bin/env python3
"""Build a disposable Go overlay with one guest-only post-account SIGKILL."""
import json
from pathlib import Path
import sys

if len(sys.argv) != 3:
    raise SystemExit('usage: jit-crash-overlay.py <repo> <private-run-dir>')
repo = Path(sys.argv[1]).resolve(strict=True)
run = Path(sys.argv[2]).resolve(strict=True)
source = repo / 'internal/provision/writer_linux.go'
original = source.read_text()
anchor = '''\t\tif e := w.Executor.Step(ctx, phase, identity); e != nil {
\t\t\treturn failure(Drift)
\t\t}
'''
if original.count(anchor) != 1 or 'nah-guest-broker-crash' in original:
    raise SystemExit('writer injection site drifted; refusing fixture build')
injected = anchor + '''\t\t// Guest-build overlay only: crash the root broker after account creation.
\t\tif phase == "account" {
\t\t\tb, err := os.ReadFile("/run/nah-guest-broker-crash")
\t\t\tif err == nil && strings.TrimSpace(string(b)) == "account" {
\t\t\t\t_ = unix.Kill(os.Getpid(), unix.SIGKILL)
\t\t\t}
\t\t}
'''
replacement = run / 'guest-writer.go'
replacement.write_text(original.replace(anchor, injected))
(run / 'guest-overlay.json').write_text(json.dumps({'Replace': {str(source): str(replacement)}}))
