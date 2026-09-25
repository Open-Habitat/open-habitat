#!/usr/bin/python3
"""Independent systemd ExecStopPost receipt; no raw unit or journal text on serial."""
import json
import os
import re
import signal
import subprocess
import tempfile


def bounded(argv):
    with tempfile.TemporaryFile() as out:
        p = subprocess.Popen(argv, stdout=out, stderr=subprocess.DEVNULL,
                             start_new_session=True)
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                p.wait(timeout=2)
            except subprocess.TimeoutExpired:
                pass
            return b""
        out.seek(0)
        return out.read(16384)


# Environment is systemd-owned, but validate before inserting into an allowlisted marker.
result, exit_code, status = [os.environ.get(k, '') for k in
                             ('SERVICE_RESULT', 'EXIT_CODE', 'EXIT_STATUS')]
if result not in ('success', 'exit-code', 'timeout', 'signal', 'core-dump',
                  'oom-kill', 'watchdog', 'resources', 'protocol'):
    result = 'unknown'
if exit_code not in ('exited', 'killed', 'dumped', 'dead'):
    exit_code = 'unknown'
if re.fullmatch(r'[0-9]{1,3}', status):
    status = str(int(status))
else:
    # systemd uses signal names such as TERM and KILL, not only numbers.
    number = getattr(signal, 'SIG' + status, None) if re.fullmatch(r'[A-Z]{2,12}', status) else None
    status = str(int(number)) if isinstance(number, signal.Signals) else 'unknown'
print('VM_REBOOT_UNIT_EXIT=' + ':'.join((result, exit_code, status)), flush=True)
try:
    raw = bounded(['journalctl', '-b', '-u', 'jit-reboot-proof.service', '-n', '12',
                   '--no-pager', '-o', 'json'])
except OSError:
    raw = b''
codes = set()
for line in raw.splitlines():
    try:
        entry = json.loads(line)
        message = entry.get('MESSAGE', '')
        if isinstance(message, str):
            # Only known systemd failure categories; never print raw journal text.
            for word in ('timeout', 'killed', 'failed', 'exited'):
                if word in message.lower():
                    codes.add(word)
    except (ValueError, TypeError, AttributeError):
        pass
print('VM_REBOOT_JOURNAL=' + (','.join(sorted(codes)) or 'none'), flush=True)
if result != 'success':
    bounded(['systemd-run', '--on-active=10s', '--unit=jit-watchdog-shutdown',
             '/usr/bin/systemctl', 'poweroff', '--no-block'])
