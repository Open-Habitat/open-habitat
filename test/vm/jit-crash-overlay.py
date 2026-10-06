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
if original.count(anchor) != 1 or 'oh-guest-broker-crash' in original:
    raise SystemExit('writer injection site drifted; refusing fixture build')
injected = anchor + '''\t\t// Guest-build overlay only: crash the root broker after account creation.
\t\tif phase == "account" {
\t\t\tb, err := os.ReadFile("/run/oh-guest-broker-crash")
\t\t\tif err == nil && strings.TrimSpace(string(b)) == "account" {
\t\t\t\t_ = unix.Kill(os.Getpid(), unix.SIGKILL)
\t\t\t}
\t\t}
'''
replacement = run / 'guest-writer.go'
replacement.write_text(original.replace(anchor, injected))
# Prove the *cause* of the refused restart, not merely an exit-code. This
# fixed, token-free diagnostic exists in the temporary guest overlay only.
broker = repo / 'internal/provision/broker_linux.go'
broker_source = broker.read_text()
startup = '\t\tif !absent(fd, n) {\n\t\t\treturn ErrBrokerStartup\n\t\t}\n'
if broker_source.count(startup) != 1 or 'OH_GUEST_PENDING_REFUSED' in broker_source:
    raise SystemExit('broker startup injection site drifted')
startup_with_diagnostic = startup.replace('\t\t\treturn ErrBrokerStartup',
    '\t\t\tif n == "pending.json" { _, _ = os.Stderr.WriteString("OH_GUEST_PENDING_REFUSED_STARTUP\\n") }\n\t\t\treturn ErrBrokerStartup')
broker_replacement = run / 'guest-broker.go'
broker_source = broker_source.replace(startup, startup_with_diagnostic)
check = 'if err != nil || !brokerSocketSafe(cfg.GatewayGID) {\n\t\treturn ErrBrokerStartup\n\t}'
if broker_source.count(check) != 1:
    raise SystemExit('broker precondition diagnostic site drifted')
broker_source = broker_source.replace(check, '''if err != nil { _, _ = os.Stderr.WriteString("OH_GUEST_CONFIG_INVALID\\n"); return ErrBrokerStartup }
	if !brokerSocketSafe(cfg.GatewayGID) { _, _ = os.Stderr.WriteString("OH_GUEST_SOCKET_UNSAFE\\n"); return ErrBrokerStartup }''')
for anchor, stage in [
    ('cfg, err := loadBrokerConfig()', 'config'),
    ('fd, err := brokerFD()', 'fd'),
    ('if writer.Startup(ctx) != nil {', 'startup'),
    ('fd, err := lockedDir(ctx, w.Dir, w.owner)', 'ledger_lock'),
]:
    if broker_source.count(anchor) != 1:
        raise SystemExit('broker diagnostic site drifted: '+stage)
    broker_source = broker_source.replace(anchor,
        '_, _ = os.Stderr.WriteString("OH_GUEST_STAGE_'+stage+'\\n")\n\t'+anchor)
broker_replacement.write_text(broker_source)
# loadBrokerConfig calls secureFile before ServeBroker reaches Writer.Startup.
# secureFile itself rejects pending.json, so instrument that actual guard too.
state = repo / 'internal/provision/state_linux.go'
state_source = state.read_text()
pending_check = '''if e := unix.Fstatat(fd, "pending.json", &st, unix.AT_SYMLINK_NOFOLLOW); e != unix.ENOENT {
		return nil, ErrInvalid
	}'''
if state_source.count(pending_check) != 1:
    raise SystemExit('secureFile pending guard drifted')
state_source = state_source.replace(pending_check, pending_check.replace(
    '\t\treturn nil, ErrInvalid',
    '\t\tif name == "broker.json" { _, _ = os.Stderr.WriteString("OH_GUEST_PENDING_REFUSED_CONFIG\\n") }\n\t\treturn nil, ErrInvalid'))
state_replacement = run / 'guest-state.go'
state_replacement.write_text(state_source)
(run / 'guest-overlay.json').write_text(json.dumps({'Replace': {
    str(source): str(replacement), str(broker): str(broker_replacement), str(state): str(state_replacement)}}))
